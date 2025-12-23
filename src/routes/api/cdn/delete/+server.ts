import { JsonErrors } from "$lib/constants.js";
import { getR2FromEvent } from "$lib/server/s3.js";
import * as Sentry from "@sentry/sveltekit";

export async function POST(event) {
  const {
    request,
    locals: { supabase },
  } = event;

  try {
    const R2 = getR2FromEvent(event);
    const { imageIds } = (await request.json()) as { imageIds: string[] };

    if (!imageIds?.length) {
      return JsonErrors.badRequest("No image IDs provided");
    }

    // Get image records to find R2 keys
    const { data: images, error: fetchError } = await supabase
      .from("images")
      .select("id, r2_key")
      .in("id", imageIds);

    if (fetchError) {
      console.error("Error fetching images:", fetchError);
      return JsonErrors.serverError("Failed to fetch images");
    }

    // Delete from R2 first
    try {
      // R2 supports deleting multiple objects at once
      const keys = images.map((image: { id: string; r2_key: string }) => image.r2_key);
      await R2.delete(keys);
    } catch (r2Error) {
      console.error("Error deleting from R2:", r2Error);
      Sentry.captureException(r2Error, {
        extra: {
          imageIds,
          r2Keys: images.map((img: { id: string; r2_key: string }) => img.r2_key),
        },
      });
    }

    // Delete from database
    const { error: deleteError } = await supabase.from("images").delete().in("id", imageIds);

    if (deleteError) {
      console.error("Error deleting from database:", deleteError);
      return JsonErrors.serverError("Failed to delete from database");
    }

    return Response.json({
      success: true,
      deletedCount: images.length,
    });
  } catch (error) {
    console.error("Error deleting images:", error);
    return Response.json({ error: "Failed to delete images" }, { status: 500 });
  }
}
