<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  4;

  let error = $state<string | null>(null);

  onMount(() => {
    const url = new URL(page.url);
    if (url.searchParams.has("error")) {
      error = url.searchParams.get("error")!;
      url.searchParams.delete("error");
      goto(url, { replaceState: true });
    }
  });
</script>

<div class="flex h-full w-full">
  <div class="card bg-error-content text-error mx-auto my-auto">
    <div class="card-body">
      <h2>Login Error. Du solltest nicht hier sein.</h2>

      {#if error}
        <p class="mt-4 text-sm text-red-600">Fehlerdetails: {error}</p>
      {/if}
    </div>
  </div>
</div>
