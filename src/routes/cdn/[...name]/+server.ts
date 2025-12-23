import { JsonErrors } from "$lib/constants";
import { getR2FromEvent } from "$lib/server/s3";
import sharp from "sharp";

// --- KV Cache Helpers ---
interface CacheEntry {
  buffer: string; // Base64 encoded for KV storage
  contentType: string;
  eTag?: string;
}

const CACHE_TTL_SECONDS = 86400; // 24 hours

async function getCachedImage(kv: KVNamespace, key: string): Promise<CacheEntry | null> {
  const cached = await kv.get<CacheEntry>(key, "json");
  return cached;
}

async function setCachedImage(kv: KVNamespace, key: string, entry: CacheEntry): Promise<void> {
  await kv.put(key, JSON.stringify(entry), { expirationTtl: CACHE_TTL_SECONDS });
}

// --- Sharp Image Processing ---
interface TransformOptions {
  width?: number;
  height?: number;
  format?: "jpeg" | "png" | "webp" | "avif";
  quality?: number;
}

function parseTransformParams(url: URL): TransformOptions {
  const params: TransformOptions = {};

  const width = url.searchParams.get("w") || url.searchParams.get("width");
  const height = url.searchParams.get("h") || url.searchParams.get("height");
  const format = url.searchParams.get("f") || url.searchParams.get("format");
  const quality = url.searchParams.get("q") || url.searchParams.get("quality");

  if (width && !isNaN(Number(width))) params.width = Number(width);
  if (height && !isNaN(Number(height))) params.height = Number(height);
  if (format && ["jpeg", "png", "webp", "avif"].includes(format)) params.format = format as any;
  if (quality && !isNaN(Number(quality))) params.quality = Math.min(100, Math.max(1, Number(quality)));

  return params;
}

async function transformImage(
  buffer: Buffer,
  options: TransformOptions,
): Promise<{ buffer: Buffer; contentType: string }> {
  let transformer = sharp(buffer);

  if (options.width || options.height) {
    transformer = transformer.resize(options.width, options.height, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Apply format and quality
  if (options.format) {
    switch (options.format) {
      case "jpeg":
        transformer = transformer.jpeg({ quality: options.quality || 80 });
        break;
      case "png":
        transformer = transformer.png({ quality: options.quality || 80 });
        break;
      case "webp":
        transformer = transformer.webp({ quality: options.quality || 80 });
        break;
      case "avif":
        transformer = transformer.avif({ quality: options.quality || 80 });
        break;
    }
  }

  const transformedBuffer = await transformer.toBuffer();
  const contentType = options.format ? `image/${options.format}` : "image/jpeg";

  return { buffer: transformedBuffer, contentType };
}

function hasTransformations(options: TransformOptions): boolean {
  return !!(options.width || options.height || options.format || options.quality);
}

// --- GET Request Handler ---
export async function GET(event) {
  const { params, getClientAddress, url, platform } = event;
  const imageName = params.name;

  if (!imageName) {
    return JsonErrors.badRequest("Image name parameter is missing.");
  }

  // Parse transformation parameters
  const transformOptions = parseTransformParams(url);
  const shouldTransform = hasTransformations(transformOptions);

  // --- Rate Limiting ---
  const ip = getClientAddress() || "unknown-client";
  const decision = await platform?.env.CDN_RATELIMIT.limit({ key: ip });

  if (!decision?.success) {
    console.warn(`[Ratelimiter] Rate limit exceeded for image "${imageName}". IP: ${ip}`);
    return JsonErrors.tooManyRequests("Too Many Requests");
  }

  // --- KV Cache Check (skip for transformed images) ---
  const kv = platform?.env.BD_IMAGE_CACHE;

  if (!shouldTransform && kv) {
    const cached = await getCachedImage(kv, imageName);
    if (cached) {
      console.log(`[Cache] HIT for image: ${imageName}`);
      const buffer = Buffer.from(cached.buffer, "base64");
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

  console.log(`[Cache] MISS for image: ${imageName}${shouldTransform ? " (transformation requested)" : ""}`);

  try {
    const R2 = getR2FromEvent(event);

    const r2Object = await R2.get(imageName);

    if (!r2Object) {
      return JsonErrors.notFound("Image not found");
    }

    // Convert the R2 response body to a Buffer
    const arrayBuffer = await r2Object.arrayBuffer();
    let imageBuffer = Buffer.from(arrayBuffer);
    let contentType = r2Object.httpMetadata?.contentType || "application/octet-stream";
    const eTag = r2Object.etag;

    // Apply transformations if requested
    if (shouldTransform) {
      try {
        const transformed = await transformImage(imageBuffer, transformOptions);
        imageBuffer = Buffer.from(transformed.buffer);
        contentType = transformed.contentType;

        console.log(
          `[Sharp] Transformed image: ${imageName}, Options: ${JSON.stringify(
            transformOptions,
          )}, Size: ${imageBuffer.length} bytes`,
        );

        return new Response(imageBuffer, {
          headers: {
            "Content-Type": contentType,
            "X-Cache-Status": "MISS-TRANSFORMED",
            "Cache-Control": "public, max-age=86400",
          },
        });
      } catch (transformError: any) {
        console.error(`[Sharp Error] Failed to transform image "${imageName}": ${transformError.message}`);
        return JsonErrors.serverError("Image transformation failed");
      }
    }

    // Store in KV cache (only original images)
    if (kv) {
      const cacheEntry: CacheEntry = {
        buffer: imageBuffer.toString("base64"),
        contentType,
        eTag,
      };
      await setCachedImage(kv, imageName, cacheEntry);
      console.log(
        `[Cache] Stored image: ${imageName}, Type: ${contentType}, Size: ${imageBuffer.length} bytes, ETag: ${eTag}`,
      );
    }

    // Return the image
    return new Response(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "X-Cache-Status": "MISS",
        ETag: eTag || "",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    // Log the detailed error for server-side debugging.
    console.error(
      `[R2 Error] Failed to fetch image "${imageName}" from R2: ${err.name} - ${err.message}`,
      err,
    );

    // If it's already a SvelteKit error object, re-throw it.
    if (err.status && typeof err.body === "object" && err.body !== null && "message" in err.body) {
      return err;
    }
    // For other errors, return a generic 500.
    return JsonErrors.serverError(`Server error fetching image: ${err.message || "Unknown R2 error"}`);
  }
}
