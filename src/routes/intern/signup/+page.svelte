<script lang="ts">
  import { enhance } from "$app/forms";
  import ChevronLeft from "$lib/assets/ChevronLeft.svelte";
  import EyeClosed from "$lib/assets/EyeClosed.svelte";
  import EyeOpen from "$lib/assets/EyeOpen.svelte";
  import Turnstile from "$lib/components/Turnstile.svelte";

  let { form } = $props<{ form: { message?: string; email?: string; success?: boolean } | null }>();

  let error = $state<string | null>(null);
  let isLoading = $state(false);
  let cfToken = $state("");

  // Password validation state
  let password = $state("");
  let passwordVisible = $state(false);
  let passwordConfirm = $state("");

  const passwordMinLength = 8;
  const passwordErrors = $derived.by(() => {
    const errors: string[] = [];
    if (password.length > 0 && password.length < passwordMinLength) {
      errors.push(`Mindestens ${passwordMinLength} Zeichen erforderlich`);
    }
    if (passwordConfirm.length > 0 && password !== passwordConfirm) {
      errors.push("Passwörter stimmen nicht überein");
    }
    return errors;
  });

  const isPasswordValid = $derived(password.length >= passwordMinLength && password === passwordConfirm);
</script>

<div class="absolute bottom-0 left-0 right-0 top-0 flex flex-col items-center justify-center gap-4 p-4">
  <div class="w-full max-w-sm">
    <h1 class="mb-6 text-center text-2xl font-bold">Registrierung</h1>

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

    <!-- Erfolgsanzeige -->
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

    <!-- Signup Form -->
    <form
      method="POST"
      action="?/signup"
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
          value={form?.email ?? ""}
          required
          class="dy-input w-full"
          autocomplete="email"
        />
        <span>E-Mail</span>
      </label>

      <label class="dy-floating-label w-full">
        <input
          type="password"
          name="password"
          placeholder="Passwort"
          required
          minlength="8"
          class="dy-input w-full {password.length > 0 && password.length < passwordMinLength
            ? 'dy-input-error'
            : password.length >= passwordMinLength
              ? 'dy-input-success'
              : ''}"
          autocomplete="new-password"
          bind:value={password}
        />
        <span>Passwort</span>
      </label>

      <label class="dy-floating-label w-full">
        <div class="dy-join dy-join-horizontal w-full">
          <input
            type={passwordVisible ? "text" : "password"}
            name="passwordConfirm"
            placeholder="Passwort bestätigen"
            required
            minlength="8"
            class="dy-input dy-join-item w-full {passwordConfirm.length > 0 && password !== passwordConfirm
              ? 'dy-input-error'
              : passwordConfirm.length > 0 && password === passwordConfirm
                ? 'dy-input-success'
                : ''}"
            autocomplete="new-password"
            bind:value={passwordConfirm}
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
        <span>Passwort bestätigen</span>
      </label>

      <!-- Password validation feedback -->
      {#if passwordErrors.length > 0}
        <ul class="text-error list-inside list-disc text-sm">
          {#each passwordErrors as err}
            <li>{err}</li>
          {/each}
        </ul>
      {/if}

      <!-- Hidden field for captcha token -->
      <input type="hidden" name="cf-turnstile-response" value={cfToken} />

      <button
        type="submit"
        class="dy-btn dy-btn-primary w-full"
        disabled={isLoading || !cfToken || !isPasswordValid}
      >
        {#if isLoading || !cfToken}
          <span class="dy-loading dy-loading-spinner"></span>
        {/if}
        Registrieren
      </button>
    </form>

    <div class="mt-6 w-full justify-center text-center">
      <Turnstile bind:token={cfToken} onerror={(e) => (error = e)} />
    </div>

    <!-- Link zum Login -->
    <div class="mt-4 text-center">
      <p class="text-sm text-gray-500">
        Bereits ein Konto?
        <a href="/intern/login" class="dy-link dy-link-primary">Hier anmelden</a>
      </p>
    </div>

    <!-- Zurück-Link -->
    <div class="mt-6 text-center">
      <a href="/" class="dy-btn dy-btn-ghost dy-btn-secondary dy-btn-sm gap-1">
        <ChevronLeft class="size-4" />
        Zurück zur Startseite
      </a>
    </div>
  </div>
</div>
