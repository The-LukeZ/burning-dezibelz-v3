import type { RequestEvent } from "@sveltejs/kit";

/**
 * Helper to get the R2 bucket binding from the platform environment.
 * This uses the native Cloudflare R2 binding instead of the AWS SDK.
 */
export function getR2Bucket(platform: App.Platform | undefined): R2Bucket {
  if (!platform?.env?.R2_IMAGES) {
    throw new Error("R2_IMAGES binding not available. Are you running in a Cloudflare Worker environment?");
  }
  return platform.env.R2_IMAGES;
}

/**
 * Helper to get R2 bucket from a request event
 */
export function getR2FromEvent(event: RequestEvent): R2Bucket {
  return getR2Bucket(event.platform);
}
