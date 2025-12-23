<script lang="ts">
  import { browser } from "$app/environment";
  import { afterNavigate } from "$app/navigation";
  import { PUBLIC_TURNSTILE_SITE_KEY } from "$env/static/public";
  import { onMount, onDestroy } from "svelte";
  import * as Sentry from "@sentry/sveltekit";

  let { token = $bindable(""), onerror }: { token: string; onerror?: (error: string) => void } = $props();

  let turnstileContainer: HTMLDivElement | null = $state(null);
  let widgetId: string | null = null;

  if (browser) {
    console.log("Turnstile sitekey type:", typeof PUBLIC_TURNSTILE_SITE_KEY);
    console.log("Turnstile sitekey value:", PUBLIC_TURNSTILE_SITE_KEY);
  }

  function renderTurnstile() {
    if (!browser || !turnstileContainer || !window.turnstile) return;

    // Validate sitekey before rendering
    if (typeof PUBLIC_TURNSTILE_SITE_KEY !== "string" || !PUBLIC_TURNSTILE_SITE_KEY) {
      onerror?.("Turnstile configuration error: missing or invalid site key");
      console.error("Invalid PUBLIC_TURNSTILE_SITE_KEY:", PUBLIC_TURNSTILE_SITE_KEY);
      Sentry.captureMessage("Turnstile configuration error: missing or invalid site key", {
        level: "error",
        extra: { siteKey: PUBLIC_TURNSTILE_SITE_KEY },
      });
      return;
    }

    // Remove existing widget if any
    if (widgetId !== null) {
      try {
        window.turnstile.remove(widgetId);
        console.log("Removed existing Turnstile widget with ID:", widgetId);
      } catch (e) {
        // Ignore errors when removing
        console.warn("Error removing Turnstile widget:", e);
      }
      widgetId = null;
    }

    token = "";

    widgetId = window.turnstile.render(turnstileContainer, {
      sitekey: PUBLIC_TURNSTILE_SITE_KEY,
      theme: "dark",
      size: "normal",
      callback: (t: string) => {
        token = t || "";
        console.log("Turnstile token received:", token.slice(0, 10) + "...");
      },
      "error-callback": (errorCode: any) => {
        token = "";
        onerror?.("Turnstile Error: " + errorCode);
      },
      "expired-callback": () => {
        token = "";
        renderTurnstile();
      },
      "timeout-callback": () => {
        token = "";
        onerror?.("Turnstile Timeout: Captcha ist abgelaufen. Bitte Seite neu laden.");
      },
    });
  }

  onMount(() => {
    const checkTurnstile = setInterval(() => {
      if (window.turnstile) {
        clearInterval(checkTurnstile);
        renderTurnstile();
      }
    }, 100);

    setTimeout(() => clearInterval(checkTurnstile), 10000);
  });

  onDestroy(() => {
    if (browser && widgetId !== null && window.turnstile) {
      try {
        window.turnstile.remove(widgetId);
      } catch (e) {
        // Ignore errors when removing
      }
    }
  });

  afterNavigate(() => {
    renderTurnstile();
  });
</script>

<div bind:this={turnstileContainer} class="cf-turnstile mx-auto"></div>
