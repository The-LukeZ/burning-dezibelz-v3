<script lang="ts">
  import Head from "$lib/components/Head.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import Turnstile from "$lib/components/Turnstile.svelte";

  let mailData = $state({
    email: "",
    subject: "",
    body: "",
    privacyPolicyAccepted: false,
  });
  let cfToken = $state("");
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  let isSubmitting = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    success = null;
    isSubmitting = true;
    const mData = $state.snapshot(mailData);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...mData,
          message: mData.body,
          turnstileToken: cfToken,
        }),
      });

      const data = (await response.json()) as { error?: string; success?: boolean; message?: string };

      if (!response.ok) {
        error = data.error || "Ein Fehler ist aufgetreten";
        return;
      }

      success = "Deine Nachricht wurde erfolgreich gesendet!";
      mailData = { email: "", subject: "", body: "", privacyPolicyAccepted: false };
      cfToken = "";
      location.reload(); // Reload to reset Turnstile
    } catch (err) {
      error = "Ein Netzwerkfehler ist aufgetreten";
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Head
  seo_config={{
    title: "Kontakt | Burning Dezibelz",
    description: "Kontaktiere uns über dieses Formular.",
    url: "https://burningdezibelz.de/kontakt",
    author_name: "Burning Dezibelz",
    language: "de",
  }}
/>

<SiteHeader title="Kontakt" />
<p class="text-base-content/65 mx-auto mb-2 text-center text-sm">Kontaktiere uns hier!</p>

<div class="grid place-items-center px-3 py-7">
  <form class="max-w-175 flex w-full flex-col items-center" onsubmit={handleSubmit}>
    {#if error}
      <div class="dy-alert dy-alert-error mb-4 w-full">
        <span>{error}</span>
      </div>
    {/if}

    {#if success}
      <div class="dy-alert dy-alert-success mb-4 w-full">
        <span>{success}</span>
      </div>
    {/if}

    <input
      {@attach (e) => e.focus({ preventScroll: true })}
      type="email"
      class="dy-input mb-0.75 w-full font-semibold text-white"
      style="font-family: Poppins, sans-serif;"
      placeholder="Deine E-Mail-Adresse"
      bind:value={mailData.email}
      required
      disabled={isSubmitting}
    />
    <input
      type="text"
      class="dy-input mb-0.75 w-full font-semibold text-white"
      style="font-family: Poppins, sans-serif;"
      placeholder="Betreff"
      bind:value={mailData.subject}
      required
      disabled={isSubmitting}
    />
    <textarea
      class="dy-textarea mb-0.75 h-72 w-full resize-none font-sans text-white"
      style="font-family: Poppins, sans-serif;"
      placeholder="Deine Nachricht"
      bind:value={mailData.body}
      required
      disabled={isSubmitting}
    ></textarea>

    <label class="dy-label mt-3">
      <input
        type="checkbox"
        required
        bind:checked={mailData.privacyPolicyAccepted}
        class="dy-checkbox dy-checkbox-primary"
      />
      Ich akzeptiere die
      <a href="/datenschutz" target="_blank" class="dy-link dy-link-primary">Datenschutzerklärung</a>.
    </label>

    {#if cfToken}
      <button
        type="submit"
        class="dy-btn dy-btn-primary dy-btn-soft dy-btn-wide mt-5"
        disabled={!cfToken || isSubmitting || !mailData.privacyPolicyAccepted}
      >
        {#if isSubmitting}
          <span class="dy-loading dy-loading-spinner"></span>
        {/if}
        {isSubmitting ? "Wird gesendet..." : "Senden"}
      </button>
    {/if}

    <div class="mt-6">
      <Turnstile bind:token={cfToken} onerror={(e) => (error = e)} />
    </div>
  </form>
</div>
