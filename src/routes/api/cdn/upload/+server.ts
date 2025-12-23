import { isValidImageMimeType, mimeTypeToExtension, normalizeName, removeExtension } from "$lib";
import { JsonErrors } from "$lib/constants.js";
import { getR2FromEvent } from "$lib/server/s3.js";

export async function POST(event) {
  const { request, locals: { supabase } } = event;

  try {
    const R2 = getR2FromEvent(event);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    let fileName = formData.get("fileName") as string | null;
    let mimeType = formData.get("mimeType") as string | null;

    // Support both FormData (with file) and just metadata
    if (file) {
      fileName = fileName || file.name;
      mimeType = mimeType || file.type;
    }

    if (!fileName || !mimeType) {
      return JsonErrors.badRequest("File name or file type is missing");
    }

    if (!isValidImageMimeType(mimeType)) {
      return JsonErrors.badRequest("Unsupported file type");
    }

    try {
      fileName = `${normalizeName(removeExtension(fileName))}${mimeTypeToExtension(mimeType, true)}` as const;
    } catch (err: any) {
      return JsonErrors.badRequest(`Invalid file type: ${err.message}`);
    }

    const objectKey = `images/${Date.now().toString()}-${fileName}`;

    // If file is provided, upload directly
    if (file) {
      const arrayBuffer = await file.arrayBuffer();

      await R2.put(objectKey, arrayBuffer, {
        httpMetadata: {
          contentType: mimeType,
        },
        customMetadata: {
          "original-filename": fileName,
        },
      });

      // Create completed image record
      const { data: imageRecord, error: dbError } = await supabase
        .from("images")
        .insert({
          name: fileName,
          mime_type: mimeType,
          r2_key: objectKey,
          status: "completed",
        })
        .select()
        .single();

      if (dbError) {
        // Rollback: delete from R2
        await R2.delete(objectKey);
        console.error("Database error:", dbError);
        return JsonErrors.serverError("Failed to create image record");
      }

      return Response.json({
        success: true,
        fileName: objectKey,
        imageId: imageRecord.id,
      });
    }

    // If no file, create a pending record for client-side upload via multipart
    const { data: imageRecord, error: dbError } = await supabase
      .from("images")
      .insert({
        name: fileName,
        mime_type: mimeType,
        r2_key: objectKey,
        status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return JsonErrors.serverError("Failed to create image record");
    }

    return Response.json({
      fileName: objectKey,
      imageId: imageRecord.id,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return JsonErrors.serverError("Failed to upload image");
  }
}
