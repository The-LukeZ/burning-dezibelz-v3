import { normalizeFolderName } from "$lib";
import { JsonErrors } from "$lib/constants.js";
import { getR2FromEvent } from "$lib/server/s3";

export async function POST(event) {
  const { request, locals: { supabase } } = event;

  try {
    const R2 = getR2FromEvent(event);

    let { imageId, newName, newFolder } = (await request.json()) as {
      imageId: string;
      newName?: string;
      newFolder?: string | null;
    };

    if (!imageId || (!newName && newFolder === undefined)) {
      return JsonErrors.badRequest("imageId and at least one of newName or newFolder are required");
    }

    // Get current image record
    const { data: image, error: fetchError } = await supabase
      .from("images")
      .select("r2_key, name, folder, id")
      .eq("id", imageId)
      .maybeSingle();

    if (fetchError || !image) {
      return JsonErrors.notFound("Image not found");
    }

    // Only update name if provided
    let newKey = image.r2_key;
    if (newName && newName !== image.name) {
      const oldKey = image.r2_key;
      newKey = `images/${newName}`;

      // Get the existing object
      const existingObject = await R2.get(oldKey);
      if (!existingObject) {
        return JsonErrors.notFound("Original file not found in R2");
      }

      // Copy to new key by putting with existing body
      await R2.put(newKey, existingObject.body, {
        httpMetadata: existingObject.httpMetadata,
        customMetadata: existingObject.customMetadata,
      });

      // Update database record
      const { error: updateError } = await supabase
        .from("images")
        .update({
          name: newName,
          r2_key: newKey,
        })
        .eq("id", imageId);

      if (updateError) {
        // Rollback: delete the copied object
        await R2.delete(newKey);
        return JsonErrors.serverError("Failed to update image name");
      }

      // Delete old object
      await R2.delete(oldKey);
    }

    // Handle folder update - convert empty string to null
    let finalFolder = newFolder === undefined ? image.folder : newFolder;
    if (newFolder !== undefined) {
      const folderValue = !newFolder ? null : normalizeFolderName(newFolder);

      if (folderValue && !/^[a-zA-Z0-9-_. ]+$/.test(folderValue)) {
        return JsonErrors.badRequest("Invalid folder name");
      }

      if (folderValue !== image.folder) {
        const { error: folderError } = await supabase
          .from("images")
          .update({ folder: folderValue })
          .eq("id", imageId);

        if (folderError) {
          return JsonErrors.serverError("Failed to update folder");
        }
      }

      finalFolder = folderValue;
    }

    return Response.json({ success: true, r2_key: newKey, folder: finalFolder });
  } catch (error) {
    console.error("Rename error:", error);
    return JsonErrors.serverError("Internal server error");
  }
}
