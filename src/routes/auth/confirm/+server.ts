// src/routes/auth/confirm/+server.js
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "@sveltejs/kit";

export async function GET({ url, locals: { supabase } }) {
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const redirectTo = url.searchParams.get("next") ?? `${url.protocol}//${url.host}/intern/home`;
  const nextUrl = new URL(redirectTo);

  if (nextUrl.origin !== url.origin) {
    redirect(303, "/auth/error?error=" + encodeURIComponent("Ungültiger Weiterleitungslink."));
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(303, redirectTo);
    }
    redirect(303, "/auth/error?error=" + encodeURIComponent(error.message));
  }

  nextUrl.pathname = "/auth/error";
  nextUrl.searchParams.set("error", "Ungültiger Bestätigungslink.");
  redirect(303, nextUrl);
}
