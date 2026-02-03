<script lang="ts">
  import { goto } from "$app/navigation";
  import { EventStore, fetchConcerts, serializeConcerts } from "$lib/stores/events.svelte.js";
  import { copyConcertLink, formatGermanDateTime, getConcertDisplayName } from "$lib/utils/concerts.js";
  import { onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  let loading = $state(true);
  let concerts = new SvelteMap<string, Concert>();

  function showConcertDetails(concertId: string) {
    goto(`/intern/concerts/edit/${concertId}?back=archive`);
  }

  async function handleDelete(concertId: string) {
    loading = true;
    const res = await fetch(`/api/concerts/${concertId}`, {
      method: "DELETE",
    });

    if (res.ok) {
    } else {
      const error = await res.json();
      console.error("Error deleting concert:", error);
    }
    loading = false;
  }

  onMount(async () => {
    const res = await fetchConcerts({
      before: new Date(),
      limit: 100,
      order: "newestFirst",
      sortBy: "timestamp",
    });

    if (Array.isArray(res)) {
      for (const concert of res) {
        concerts.set(concert.id, concert);
      }
      loading = false;
    } else {
      console.error("Error fetching concerts");
    }
  });
</script>

<div class="flex flex-col items-center justify-between gap-2 md:flex-row">
  <h1 class="text-2xl font-bold">Konzertverwaltung (Archiv)</h1>
  <div class="ml-auto grid grid-cols-1 items-center gap-2 md:grid-cols-2">
    <a href="/intern/concerts" class="dy-btn dy-btn-soft dy-btn-success dy-btn-sm">
      📅 Anstehende Konzerte
    </a>
    <a href="/intern/concerts/new?back=archive" class="dy-btn dy-btn-soft">Konzert hinzufügen</a>
  </div>
</div>

<div class="overflow-x-auto">
  <table class="dy-table dy-table-zebra min-w-md table w-full">
    <thead>
      <tr>
        <th>Datum</th>
        <th>Typ</th>
        <th>Name</th>
        <th>Veranstaltungsort</th>
        <th>Aktionen</th>
      </tr>
    </thead>
    <tbody>
      {#if !loading && concerts.size > 0}
        {#each serializeConcerts(concerts) as concert}
          <tr
            id={concert.id}
            class="hover:bg-primary/15 cursor-pointer transition-colors duration-75"
            onclick={() => showConcertDetails(concert.id)}
          >
            <td>{formatGermanDateTime(concert.timestamp)}</td>
            <td>
              <pre>{concert.type === "closed" ? "Geschlossen" : "Öffentlich"}</pre>
            </td>
            {#if concert.type === "public"}
              <td>{getConcertDisplayName(concert)}</td>
              <td>
                {concert.venue_id
                  ? (EventStore.venues?.get(concert.venue_id)?.name ?? "Unbekannter Ort")
                  : "Kein Ort"}
              </td>
            {:else}
              <td colspan="2" class="dy-glass border-0 text-center">Privates Konzert</td>
            {/if}
            <td class="flex w-min flex-row gap-1">
              <button
                class="dy-btn dy-btn-sm dy-btn-error dy-btn-outline w-auto"
                disabled={loading}
                onclickcapture={async (e) => {
                  e.stopPropagation();
                  if (
                    confirm("Bist du sicher, dass du dieses Konzert löschen möchtest?\nID: " + concert.id)
                  ) {
                    await handleDelete(concert.id);
                  }
                }}
              >
                Löschen
              </button>
              <button
                class="dy-btn dy-btn-sm dy-btn-info dy-btn-outline w-auto"
                onclickcapture={async (e) => {
                  e.stopPropagation();
                  await copyConcertLink(
                    concert.id,
                    concert.venue_id ? EventStore.venues.get(concert.venue_id)?.name : null,
                  );
                }}
              >
                Share
              </button>
            </td>
          </tr>
        {/each}
      {:else if !loading && concerts.size === 0}
        <tr>
          <td colspan="5" class="text-center">No concerts found.</td>
        </tr>
      {:else}
        <tr>
          <td colspan="5" class="text-center">
            <span class="dy-loading dy-loading-dots"></span>
          </td>
        </tr>
      {/if}
    </tbody>
  </table>
</div>
