<script lang="ts">
  import { afterNavigate, beforeNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import Footer from "$lib/components/Footer.svelte";
  import Navbar from "$lib/components/Navbar.svelte";
  import "$lib/stores/events.svelte.js";
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { invalidate } from '$app/navigation';
  import "../app.css";

  let { data, children } = $props();
  let { supabase, session } = $derived(data);
  let pageLoading = $state(false);

  beforeNavigate(async () => {
    pageLoading = true;
  });

  afterNavigate(async () => {
    // Reset pageLoading after navigation
    pageLoading = false;
  });

  $effect(() => {
    if (session) {
      console.log("User is logged in:", $state.snapshot(session.user));
    }
  })

  onMount(() => {
		const { data } = supabase.auth.onAuthStateChange((event, _session) => {
			if (_session?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth')
			}
		});

		return () => data.subscription.unsubscribe();
	});
</script>

<Navbar />

<div class="page-container" class:with-margin={page.url.pathname !== "/"} class:grid={pageLoading}>
  {#if !pageLoading}
    {@render children()}
  {:else}
    <div
      class="relative grid min-h-full w-full place-items-center"
      transition:slide={{ duration: 200, axis: "y" }}
    >
      <span class="dy-loading dy-loading-spinner w-20"></span>
    </div>
  {/if}
</div>

{#if !page.url.pathname.startsWith("/intern")}
  <Footer />
{/if}

<div class="dy-toast dy-toast-bottom dy-toast-center items-center">
  <!-- TODO: Add Adblock Alert (doesn't really work atm) -->
</div>

<style>
  .page-container {
    min-height: calc(100vh - var(--navbar-height) - 4rem);
    width: 100%;
    overflow: hidden;
    margin-top: 0;

    &.with-margin {
      margin-top: var(--navbar-height);
    }
  }
</style>
