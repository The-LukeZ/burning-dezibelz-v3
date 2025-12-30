<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import ChevronLeft from "$lib/assets/ChevronLeft.svelte";
  import EyeClosed from "$lib/assets/EyeClosed.svelte";
  import EyeOpen from "$lib/assets/EyeOpen.svelte";
  import Turnstile from "$lib/components/Turnstile.svelte";
  import { onMount } from "svelte";

  type LoginMethod = "password" | "magiclink" | "google";

  let { form } = $props<{ form: { message?: string; email?: string; success?: boolean } | null }>();

  let error = $state<string | null>(null);
  let activeMethod = $state<LoginMethod>("password");
  let isLoading = $state(false);
  let cfToken = $state("");

  // Password validation state
  let password = $state("");
  let passwordVisible = $state(false);
  const passwordMinLength = 8;
  const isPasswordValid = $derived(password.length >= passwordMinLength);

  const nextUrl = $derived(page.url.searchParams.get("next") ?? "/intern/home");

  onMount(() => {
    const url = new URL(page.url);
    if (url.searchParams.has("error")) {
      error = url.searchParams.get("error")!;
      url.searchParams.delete("error");
      goto(url, { replaceState: true });
    }
  });

  function setMethod(method: LoginMethod) {
    activeMethod = method;
    error = null;
  }
</script>

<div class="absolute top-0 right-0 bottom-0 left-0 flex flex-col items-center justify-center gap-4 p-4">
  <div class="w-full max-w-sm">
    <h1 class="mb-6 text-center text-2xl font-bold">Intern Login</h1>

    <!-- Fehleranzeige -->
    {#if error || (form?.message && !form?.success)}
      <div class="dy-alert dy-alert-error mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6 shrink-0 stroke-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{error || form?.message}</span>
      </div>
    {/if}

    <!-- Erfolgsanzeige für Magic Link -->
    {#if form?.success}
      <div class="dy-alert dy-alert-success mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6 shrink-0 stroke-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{form.message}</span>
      </div>
    {/if}

    <!-- Tab-Navigation -->
    <div role="tablist" class="dy-tabs dy-tabs-border mb-6">
      <button
        role="tab"
        class="dy-tab {activeMethod === 'password' ? 'dy-tab-active' : ''}"
        onclick={() => setMethod('password')}
      >
        Passwort
      </button>
      <button
        role="tab"
        class="dy-tab {activeMethod === 'magiclink' ? 'dy-tab-active' : ''}"
        onclick={() => setMethod('magiclink')}
      >
        Magic Link
      </button>
      <button
        role="tab"
        class="dy-tab {activeMethod === 'google' ? 'dy-tab-active' : ''}"
        onclick={() => setMethod('google')}
      >
        Google
      </button>
    </div>

    <!-- Passwort Login -->
    {#if activeMethod === "password"}
      <form
        method="POST"
        action="?/password&next={encodeURIComponent(nextUrl)}"
        use:enhance={() => {
        isLoading = true;
        return async ({ update }) => {
          await update();
          isLoading = false;
        };
      }}
        class="flex flex-col gap-4"
      >
        <label class="dy-floating-label w-full">
          <input
            type="email"
            name="email"
            placeholder="E-Mail"
            value={form?.email ?? ''}
            required
            class="dy-input w-full"
            autocomplete="email"
          />
          <span>E-Mail</span>
        </label>

        <label class="dy-floating-label w-full">
          <div class="dy-join dy-join-horizontal w-full">
            <input
              type={passwordVisible ? "text" : "password"}
              name="password"
              placeholder="Passwort"
              required
              class="dy-input dy-join-item w-full {password.length > 0 && !isPasswordValid ? 'dy-input-error' : ''}"
              autocomplete="current-password"
              bind:value={password}
            />
            <button
              type="button"
              class="dy-btn dy-btn-primary dy-join-item dy-btn-square"
              onclick={() => (passwordVisible = !passwordVisible)}
              tabindex="-1"
            >
              {#if passwordVisible}
                <EyeOpen />
              {:else}
                <EyeClosed />
              {/if}
            </button>
          </div>
          <span>Passwort</span>
        </label>

        {#if password.length > 0 && !isPasswordValid}
          <p class="text-sm text-error">Mindestens {passwordMinLength} Zeichen erforderlich</p>
        {/if}

        <button type="submit" class="dy-btn dy-btn-primary w-full" disabled={isLoading || !cfToken || !isPasswordValid}>
          {#if isLoading}
            <span class="dy-loading dy-loading-spinner"></span>
          {/if}
          Anmelden
        </button>
        <input type="hidden" name="cf-turnstile-response" value={cfToken} />
      </form>

      <!-- Magic Link Login -->
    {:else if activeMethod === "magiclink"}
      <form
        method="POST"
        action="?/magiclink&next={encodeURIComponent(nextUrl)}"
        use:enhance={() => {
        isLoading = true;
        return async ({ update }) => {
          await update();
          isLoading = false;
        };
      }}
        class="flex flex-col gap-4"
      >
        <label class="dy-floating-label w-full">
          <input
            type="email"
            name="email"
            placeholder="E-Mail"
            required
            class="dy-input w-full"
            autocomplete="email"
          />
          <span>E-Mail</span>
        </label>

        <button type="submit" class="dy-btn dy-btn-primary w-full" disabled={isLoading || !cfToken}>
          {#if isLoading}
            <span class="dy-loading dy-loading-spinner"></span>
          {/if}
          Magic Link senden
        </button>

        <p class="text-center text-sm text-gray-500">Ein Login-Link wird an deine E-Mail gesendet.</p>
        <input type="hidden" name="cf-turnstile-response" value={cfToken} />
      </form>
      <!-- Google Login -->
    {:else}
      <form method="POST" action="?/google&next={encodeURIComponent(nextUrl)}" class="flex flex-col gap-4">
        <button
          type="submit"
          class="dy-btn dy-btn-lg w-full gap-2 bg-white text-black hover:bg-[#3b3b3b] hover:text-white"
          disabled={isLoading || !cfToken}
        >
          <svg
            aria-label="Google logo"
            width="16"
            height="16"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            class="block size-6"
          >
            <g>
              <path d="m0 0H512V512H0" fill="transparent"></path>
              <path fill="#34a853" d="M153 292c30 82 118 95 171 60h62v48A192 192 0 0190 341"></path>
              <path fill="#4285f4" d="m386 400a140 175 0 0053-179H260v74h102q-7 37-38 57"></path>
              <path fill="#fbbc02" d="m90 341a208 200 0 010-171l63 49q-12 37 0 73"></path>
              <path fill="#ea4335" d="m153 219c22-69 116-109 179-50l55-54c-78-75-230-72-297 55"></path>
            </g>
          </svg>
          Mit Google anmelden
        </button>
      </form>
    {/if}

    <div class="mt-6 text-center justify-center w-full">
      <Turnstile bind:token={cfToken} onerror={(e) => error = e} />
    </div>

    <!-- Zurück-Link -->
    <div class="mt-6 text-center flex flex-col gap-4">
      {#if activeMethod !== "google"}
        <p class="text-sm text-gray-400">
          Kein Konto?
          <a href="/intern/signup" class="dy-link dy-link-secondary">Registrieren</a>
        </p>
      {/if}
      <a href="/" class="dy-btn dy-btn-ghost dy-btn-secondary dy-btn-sm gap-1">
        <ChevronLeft class="size-4" />
        Zurück zur Startseite
      </a>
    </div>
  </div>
</div>
