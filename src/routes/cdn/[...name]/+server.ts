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
  return !!(options.width || options.height || options.format || options.quality || options.fit);
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

// --- GET Request Handler ---
export async function GET(event) {
  const { params, getClientAddress, url, platform, request } = event;
  const imageName = params.name;

  if (!imageName) {
    return JsonErrors.badRequest("Image name parameter is missing.");
  }

  const transformOptions = parseTransformParams(url);
  const shouldTransform = hasTransformations(transformOptions);
  const cacheKey = buildCacheKey(imageName, transformOptions);

  // --- Rate Limiting ---
  const ip = getClientAddress() || "unknown-client";
  const decision = await platform?.env.CDN_RATELIMIT.limit({ key: ip });

  if (!decision?.success) {
    console.warn(`[Ratelimiter] Rate limit exceeded for image "${imageName}". IP: ${ip}`);
    return JsonErrors.tooManyRequests("Too Many Requests");
  }

  // --- KV Cache Check ---
  const kv = platform?.env.BD_IMAGE_CACHE;

  if (kv) {
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

  console.log(`[Cache] MISS for image: ${cacheKey}${shouldTransform ? " (transformation requested)" : ""}`);

  try {
    // Fetch from R2 first to check if image exists
    const R2 = getR2FromEvent(event);
    const r2Object = await R2.get(imageName);

    if (!r2Object) {
      return JsonErrors.notFound("Image not found");
    }

    const originalContentType = r2Object.httpMetadata?.contentType || "application/octet-stream";
    const eTag = r2Object.etag;

    // If transformations are requested, use Cloudflare Image Resizing
    if (shouldTransform) {
      console.log(`[Transform] Applying transformations:`, transformOptions);

      // Build the URL to the original image on our CDN
      const originalImageUrl = `${url.origin}/cdn/${imageName}`;

      // Fetch with Cloudflare Image Resizing options
      const transformedResponse = await fetch(originalImageUrl, {
        cf: {
          image: transformOptions,
        },
        headers: {
          Accept: request.headers.get("Accept") || "image/*",
        },
      });

      if (!transformedResponse.ok) {
        console.warn(
          `[Transform] Cloudflare Image Resizing failed (${transformedResponse.status}), returning original`,
        );

        // Fallback to original image
        const arrayBuffer = await r2Object.arrayBuffer();
        return new Response(arrayBuffer, {
          headers: {
            "Content-Type": originalContentType,
            "X-Cache-Status": "MISS-TRANSFORM-FAILED",
            ETag: eTag || "",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }

      const transformedBuffer = await transformedResponse.arrayBuffer();
      const transformedContentType =
        transformedResponse.headers.get("Content-Type") ||
        (transformOptions.format ? `image/${transformOptions.format}` : originalContentType);

      // Cache the transformed image
      if (kv) {
        try {
          const base64 = arrayBufferToBase64(transformedBuffer);
          const cacheEntry: CacheEntry = {
            buffer: base64,
            contentType: transformedContentType,
          };
          await setCachedImage(kv, cacheKey, cacheEntry);
          console.log(`[Cache] Stored transformed image: ${cacheKey}`);
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

    // No transformation - return original from R2
    const arrayBuffer = await r2Object.arrayBuffer();

    // Store original in KV cache
    if (kv) {
      try {
        const base64 = arrayBufferToBase64(arrayBuffer);
        const cacheEntry: CacheEntry = {
          buffer: base64,
          contentType: originalContentType,
          eTag,
        };
        await setCachedImage(kv, cacheKey, cacheEntry);
        console.log(`[Cache] Stored original image: ${cacheKey}`);
      } catch (cacheErr) {
        console.warn(`[Cache] Failed to cache original image: ${cacheErr}`);
      }
    }

    return new Response(arrayBuffer, {
      headers: {
        "Content-Type": originalContentType,
        "X-Cache-Status": "MISS",
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
