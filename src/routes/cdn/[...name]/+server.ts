import { JsonErrors } from "$lib/constants";
import { getR2FromEvent } from "$lib/server/s3";

// --- KV Cache Helpers ---
interface CacheEntry {
  buffer: string;
  contentType: string;
  eTag?: string;
}

const CACHE_TTL_SECONDS = 86400;

async function getCachedImage(kv: KVNamespace, key: string): Promise<CacheEntry | null> {
  const cached = await kv.get<CacheEntry>(key, "json");
  return cached;
}

async function setCachedImage(kv: KVNamespace, key: string, entry: CacheEntry): Promise<void> {
  await kv.put(key, JSON.stringify(entry), { expirationTtl: CACHE_TTL_SECONDS });
}

// Helper to convert ArrayBuffer to base64 without stack overflow
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB chunks to avoid call stack issues
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }

  return btoa(binary);
}

// --- Image Transform Options ---
interface TransformOptions {
  width?: number;
  height?: number;
  format?: "jpeg" | "png" | "webp" | "avif";
  quality?: number;
  fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
}

function parseTransformParams(url: URL): TransformOptions {
  const params: TransformOptions = {};

  const width = url.searchParams.get("w") || url.searchParams.get("width");
  const height = url.searchParams.get("h") || url.searchParams.get("height");
  const format = url.searchParams.get("f") || url.searchParams.get("format");
  const quality = url.searchParams.get("q") || url.searchParams.get("quality");
  const fit = url.searchParams.get("fit");

  if (width && !isNaN(Number(width))) params.width = Number(width);
  if (height && !isNaN(Number(height))) params.height = Number(height);
  if (format && ["jpeg", "png", "webp", "avif"].includes(format))
    params.format = format as TransformOptions["format"];
  if (quality && !isNaN(Number(quality))) params.quality = Math.min(100, Math.max(1, Number(quality)));
  if (fit && ["scale-down", "contain", "cover", "crop", "pad"].includes(fit))
    params.fit = fit as TransformOptions["fit"];

  return params;
}

function hasTransformations(options: TransformOptions): boolean {
  return !!(options.width || options.height || options.format || options.quality);
}

function buildCacheKey(imageName: string, options: TransformOptions): string {
  if (!hasTransformations(options)) return imageName;

  const parts = [imageName];
  if (options.width) parts.push(`w${options.width}`);
  if (options.height) parts.push(`h${options.height}`);
  if (options.format) parts.push(`f${options.format}`);
  if (options.quality) parts.push(`q${options.quality}`);
  if (options.fit) parts.push(`fit${options.fit}`);

  return parts.join("_");
}

function buildCfImageOptions(options: TransformOptions): string {
  const parts: string[] = [];

  if (options.width) parts.push(`width=${options.width}`);
  if (options.height) parts.push(`height=${options.height}`);
  if (options.format) parts.push(`format=${options.format}`);
  if (options.quality) parts.push(`quality=${options.quality}`);
  if (options.fit) parts.push(`fit=${options.fit}`);

  return parts.join(",");
}

// --- GET Request Handler ---
export async function GET(event) {
  const { params, getClientAddress, url, platform, request } = event;
  const imageName = params.name;

  // Check if this is an internal request from Cloudflare Image Resizing
  const isInternalTransformRequest = request.headers.get("via")?.includes("image-resizing");

  if (!imageName) {
    return JsonErrors.badRequest("Image name parameter is missing.");
  }

  const transformOptions = parseTransformParams(url);
  const shouldTransform = hasTransformations(transformOptions) && !isInternalTransformRequest;
  const cacheKey = buildCacheKey(imageName, transformOptions);

  // --- Rate Limiting ---
  const ip = getClientAddress() || "unknown-client";
  const decision = await platform?.env.CDN_RATELIMIT.limit({ key: ip });

  if (!decision?.success) {
    console.warn(`[Ratelimiter] Rate limit exceeded for image "${imageName}". IP: ${ip}`);
    return JsonErrors.tooManyRequests("Too Many Requests");
  }

  // --- KV Cache Check (skip for internal transform requests) ---
  const kv = platform?.env.BD_IMAGE_CACHE;

  if (kv && !isInternalTransformRequest) {
    const cached = await getCachedImage(kv, cacheKey);
    if (cached) {
      console.log(`[Cache] HIT for image: ${cacheKey}`);
      const buffer = Uint8Array.from(atob(cached.buffer), (c) => c.charCodeAt(0));
      return new Response(buffer, {
        headers: {
          "Content-Type": cached.contentType,
          "X-Cache-Status": "HIT",
          ETag: cached.eTag || "",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  }

  console.log(
    `[Cache] MISS for image: ${cacheKey}${shouldTransform ? " (transformation requested)" : ""}${isInternalTransformRequest ? " (internal transform fetch)" : ""}`,
  );

  // If transformations are requested and this is NOT an internal request,
  // redirect to the /cdn-cgi/image/ endpoint
  if (shouldTransform) {
    const cfOptions = buildCfImageOptions(transformOptions);
    const origin = url.origin;

    // Build the /cdn-cgi/image/ URL that points back to our CDN route (without transform params)
    const originalImageUrl = `${origin}/cdn/${imageName}`;
    const transformUrl = `${origin}/cdn-cgi/image/${cfOptions}/${originalImageUrl}`;

    console.log(`[Transform] Redirecting to: ${transformUrl}`);

    // Fetch the transformed image from Cloudflare's image resizing service
    const transformedResponse = await fetch(transformUrl, {
      headers: {
        // Pass through accept header for format negotiation
        Accept: request.headers.get("Accept") || "image/*",
      },
    });

    if (!transformedResponse.ok) {
      console.warn(
        `[Transform] Cloudflare Image Resizing failed (${transformedResponse.status}), returning original`,
      );
      // Fallback to original image
      try {
        const R2 = getR2FromEvent(event);
        const r2Object = await R2.get(imageName);

        if (!r2Object) {
          return JsonErrors.notFound("Image not found");
        }

        const arrayBuffer = await r2Object.arrayBuffer();
        const contentType = r2Object.httpMetadata?.contentType || "application/octet-stream";

        return new Response(arrayBuffer, {
          headers: {
            "Content-Type": contentType,
            "X-Cache-Status": "MISS-TRANSFORM-FAILED",
            ETag: r2Object.etag || "",
            "Cache-Control": "public, max-age=86400",
          },
        });
      } catch (fallbackErr: any) {
        console.error(`[Fallback Error] ${fallbackErr.message}`);
        return JsonErrors.serverError("Failed to fetch image");
      }
    }

    const transformedBuffer = await transformedResponse.arrayBuffer();
    const transformedContentType =
      transformedResponse.headers.get("Content-Type") ||
      (transformOptions.format ? `image/${transformOptions.format}` : "application/octet-stream");

    // Cache the transformed image
    if (kv) {
      try {
        const base64 = arrayBufferToBase64(transformedBuffer);
        const cacheEntry: CacheEntry = {
          buffer: base64,
          contentType: transformedContentType,
        };
        await setCachedImage(kv, cacheKey, cacheEntry);
      } catch (cacheErr) {
        console.warn(`[Cache] Failed to cache transformed image: ${cacheErr}`);
      }
    }

    return new Response(transformedBuffer, {
      headers: {
        "Content-Type": transformedContentType,
        "X-Cache-Status": "MISS-TRANSFORMED",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // No transformation or internal request - fetch from R2 and return original
  try {
    const R2 = getR2FromEvent(event);
    const r2Object = await R2.get(imageName);

    if (!r2Object) {
      return JsonErrors.notFound("Image not found");
    }

    const originalContentType = r2Object.httpMetadata?.contentType || "application/octet-stream";
    const eTag = r2Object.etag;
    const arrayBuffer = await r2Object.arrayBuffer();

    // Store in KV cache (skip for internal transform requests to avoid duplicate caching)
    if (kv && !isInternalTransformRequest) {
      try {
        const base64 = arrayBufferToBase64(arrayBuffer);
        const cacheEntry: CacheEntry = {
          buffer: base64,
          contentType: originalContentType,
          eTag,
        };
        await setCachedImage(kv, cacheKey, cacheEntry);
      } catch (cacheErr) {
        console.warn(`[Cache] Failed to cache original image: ${cacheErr}`);
      }
    }

    return new Response(arrayBuffer, {
      headers: {
        "Content-Type": originalContentType,
        "X-Cache-Status": isInternalTransformRequest ? "ORIGIN" : "MISS",
        ETag: eTag || "",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    console.error(`[R2 Error] Failed to fetch image "${imageName}": ${err.message}`, err);

    if (err.status && typeof err.body === "object" && err.body !== null && "message" in err.body) {
      return err;
    }
    return JsonErrors.serverError(`Server error fetching image: ${err.message || "Unknown error"}`);
  }
}
