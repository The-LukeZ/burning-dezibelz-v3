import { fail, redirect } from "@sveltejs/kit";
import * as Sentry from "@sentry/sveltekit";

export async function load({ locals }) {
  if (locals.user && locals.session) {
    // User is already authenticated, redirect to home
    redirect(303, "/intern/home");
  }

  return {};
}

function validateNextUrl(next: string) {
  if (next.startsWith("/")) {
    return next;
  } else {
    return "/intern/home";
  }
}

export const actions = {
  signup: async ({ request, url, locals: { supabase } }) => {
    const formData = await request.formData();
    const email = formData.get("email")?.toString();
    const password = formData.get("password")?.toString();
    const passwordConfirm = formData.get("passwordConfirm")?.toString();
    const captchaToken = formData.get("cf-turnstile-response")?.toString();

    // Validate required fields
    if (!email || !password || !passwordConfirm) {
      return fail(400, {
        message: "Alle Felder müssen ausgefüllt werden",
        email,
      });
    }

    // Validate password match
    if (password !== passwordConfirm) {
      return fail(400, {
        message: "Passwörter stimmen nicht überein",
        email,
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return fail(400, {
        message: "Passwort muss mindestens 8 Zeichen lang sein",
        email,
      });
    }

    // Validate captcha
    if (!captchaToken) {
      return fail(400, {
        message: "Captcha ist erforderlich",
        email,
      });
    }

    const redirectTo = new URL("/", url.protocol + "//" + url.host);
    redirectTo.pathname = validateNextUrl(url.searchParams.get("next") || "/intern/home");

    // Sign up with Supabase
    const { error: err, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken: captchaToken,
        emailRedirectTo: redirectTo.toString(),
      },
    });

    Sentry.logger.info("Signup attempt", { email, error: err?.message, data: data });
    if ((!data.user && !!data.session) || (!!data.user && !!data.session)) {
      // User is automatically logged in after sign-up (hopefully)
      redirect(303, validateNextUrl(url.searchParams.get("next") || "/intern/home"));
    } else if (!data.user && !data.session) {
      // User needs to confirm their email
      return {
        success: true,
        message: "Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse.",
      };
    }

    if (err) {
      console.error("Error signing up:", err.message);

      // Handle specific Supabase errors
      if (err.message.includes("already registered")) {
        return fail(400, {
          message: "Diese E-Mail-Adresse ist bereits registriert",
          email,
        });
      } else if (err.message.includes("Password should contain")) {
        return fail(400, {
          message: "Passwort muss mindestens 8 Zeichen lang sein und mindestens eine Zahl enthalten",
          email,
        });
      } else if (err.message.includes("not allowed")) {
        return fail(400, {
          message: "Du darfst dich mit dieser E-Mail-Adresse nicht registrieren",
          email,
        });
      }

      return fail(400, {
        message: "Fehler bei der Registrierung",
        email,
      });
    }

    return {
      success: true,
      message: "Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse.",
    };
  },
};
