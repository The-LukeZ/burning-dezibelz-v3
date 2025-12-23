import { JsonErrors } from "$lib/constants.js";
import { getR2FromEvent } from "$lib/server/s3.js";

export async function POST(event) {
  const {
    request,
    locals: { supabase },
  } = event;

  try {
    const R2 = getR2FromEvent(event);
    const { imageId } = (await request.json()) as { imageId: string };

    const { data: imageData, error: fetchError } = await supabase
      .from("images")
      .select("id, r2_key, status")
      .eq("id", imageId)
      .maybeSingle();

    if (fetchError || !imageData) {
      console.error("Error fetching image data:", fetchError);
      return JsonErrors.serverError("Failed to fetch image data");
    }

    // Check if file exists in R2 using head()
    const headResult = await R2.head(imageData.r2_key);

    if (!headResult) {
      return JsonErrors.notFound("File not found in R2");
    }

    // Update the image record to mark as successfully uploaded
    const { error } = await supabase
      .from("images")
      .update({
        status: "completed",
        created_at: new Date().toISOString(),
      })
      .eq("id", imageId);

    if (error) {
      console.error("Failed to confirm upload:", error);
      return JsonErrors.serverError("Failed to confirm upload");
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error confirming upload:", error);
    return JsonErrors.serverError("Failed to confirm upload");
  }
}
