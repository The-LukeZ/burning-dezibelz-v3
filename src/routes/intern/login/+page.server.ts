import { fail, redirect } from "@sveltejs/kit";
import { TURNSTILE_SECRET } from "$env/static/private";
import * as Sentry from "@sentry/sveltekit";

export async function load({ locals }) {
  if (locals.user && locals.session) {
    // User is already authenticated, redirect to home
    redirect(303, "/intern/home");
  }

  return {};
}

// Only used for Google OAuth, as Supabase handles Turnstile verification for other methods
async function verifyCaptcha(token: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) {
    console.error("Cloudflare Turnstile secret key is not set");
    Sentry.captureException(new Error("Cloudflare Turnstile secret key is not set"));
    return false;
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret: TURNSTILE_SECRET,
      response: token,
    }),
  });

  const data = (await response.json()) as { success: boolean };
  return data.success;
}

function validateNextUrl(next: string) {
  if (next.startsWith("/")) {
    return next;
  } else {
    return "/intern/home";
  }
}

export const actions = {
  google: async ({ url, locals: { supabase } }) => {
    const captchaToken = url.searchParams.get("cf-turnstile-response") || "";
    const isCaptchaValid = await verifyCaptcha(captchaToken);

    if (!isCaptchaValid) {
      return fail(400, {
        message: "Captcha-Überprüfung fehlgeschlagen",
      });
    }

    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${url.origin}/api/google-auth/callback?next=${url.searchParams.get("next") || "/intern/home"}`,
        skipBrowserRedirect: true,
      },
    });

    if (err) {
      console.error("Error signing in with OAuth:", err.message);
      Sentry.captureException(err);
      return fail(400, {
        message: "Fehler beim Google Login",
      });
    }

    redirect(303, data.url);
  },

  password: async ({ request, url, locals: { supabase } }) => {
    const formData = await request.formData();
    const email = formData.get("email")?.toString();
    const password = formData.get("password")?.toString();
    const captchaToken = formData.get("cf-turnstile-response")?.toString();

    if (!email || !password) {
      return fail(400, {
        message: "E-Mail und Passwort sind erforderlich",
        email,
      });
    }

    const { error: err, data } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken: captchaToken,
      },
    });

    if (err) {
      console.error("Error signing in with password:", err.message);
      return fail(400, {
        message: "Ungültige Anmeldedaten",
        email,
      });
    }

    const next = url.searchParams.get("next") || "/intern/home";
    redirect(303, validateNextUrl(next));
  },

  magiclink: async ({ request, url, locals: { supabase } }) => {
    const formData = await request.formData();
    const email = formData.get("email")?.toString();
    const captchaToken = formData.get("cf-turnstile-response")?.toString();
    const nextUrl = formData.get("next")?.toString() || "";

    if (!email) {
      return fail(400, {
        message: "E-Mail ist erforderlich",
      });
    }

    const redirectTo = new URL(url.toString());
    redirectTo.pathname = validateNextUrl(nextUrl);

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        captchaToken: captchaToken,
        emailRedirectTo: redirectTo.toString(),
      },
    });

    if (err) {
      console.error("Error sending magic link:", err.message);
      return fail(400, {
        message: "Fehler beim Senden des Magic Links",
      });
    }

    return {
      success: true,
      message: "Magic Link wurde an deine E-Mail gesendet!",
    };
  },
};
