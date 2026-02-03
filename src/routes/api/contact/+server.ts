import { env } from "$env/dynamic/private";
import { TURNSTILE_SECRET } from "$env/static/private";
import { JsonErrors } from "$lib/constants";
import { ContactSchema } from "$lib/utils/assertions";
import { Validator } from "$lib/utils/validator";
import { json, type RequestEvent } from "@sveltejs/kit";
import { Resend } from "resend";
import z from "zod";
import { ValidationError } from "zod-validation-error";

async function verifyTurnstile(token: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) {
    console.error("Cloudflare Turnstile secret key is not set");
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

const contactValidator = new Validator(ContactSchema);

export const POST = async ({ request }: RequestEvent) => {
  try {
    const body = await request.json();
    let parsed: z.infer<typeof ContactSchema>;
    try {
      parsed = contactValidator.validate(body);
    } catch (err) {
      return JsonErrors.badRequest((err as ValidationError).message);
    }

    const { email, subject, message, turnstileToken } = parsed;

    // Verify Turnstile token
    const isTurnstileValid = await verifyTurnstile(turnstileToken);
    if (!isTurnstileValid) {
      return json({ error: "Captcha-Überprüfung fehlgeschlagen" }, { status: 400 });
    }

    // Check if Resend API key is configured
    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not set");
      return json({ error: "E-Mail-Dienst nicht konfiguriert" }, { status: 500 });
    }

    // Send email using Resend
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: "Kontaktformular <noreply@burningdezibelz.de>",
      to: ["burningdezibelz@gmail.com"],
      replyTo: email,
      subject: `[Kontaktformular] ${subject}`,
      text: `Von: ${email}\n\n${message}`,
      html: `
        <h2>Neue Kontaktanfrage</h2>
        <p><strong>Von:</strong> ${escapeHtml(email)}</p>
        <p><strong>Betreff:</strong> ${escapeHtml(subject)}</p>
        <hr />
        <p><strong>Nachricht:</strong></p>
        <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      `,
    });

    if (error) {
      console.error("Error sending email:", error);
      return json({ error: "Fehler beim Senden der E-Mail" }, { status: 500 });
    }

    return json({ success: true, message: "Nachricht erfolgreich gesendet" });
  } catch (err) {
    console.error("Contact form error:", err);
    return json({ error: "Ein unerwarteter Fehler ist aufgetreten" }, { status: 500 });
  }
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
