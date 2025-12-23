<script lang="ts">
  import { page } from "$app/state";
  import XIcon from "$lib/assets/XIcon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import type { Database } from "$lib/supabase";
  import { formatGermanDateTime } from "$lib/utils/concerts.js";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  let { supabase } = page.data;
  let showNotAdminNote = $state(true);
  let users = $state<AllowedUser[]>([]);
  let loading = $state(true);
  const newUserData = $state<{
    modalOpen: boolean;
    user: Database["public"]["Tables"]["allowed_users"]["Insert"] | null;
  }>({
    modalOpen: false,
    user: null,
  });
  const selectUser = $state<{
    modalOpen: boolean;
    user: AllowedUser | null;
  }>({
    modalOpen: false,
    user: null,
  });
  let error = $state<string | null>(null);

  function openCreateUserModal() {
    newUserData.modalOpen = true;
    newUserData.user = {
      email: "",
      role: "user",
      notes: "",
    };
  }

  async function updateUser(
    user: Database["public"]["Tables"]["allowed_users"]["Update"] & { email: string },
  ) {
    error = null;
    loading = true;
    const { data: upUser, error: updateError } = await supabase
      .rpc("update_allowed_user", {
        p_target_email: user.email,
        p_new_role: user.role,
        p_new_notes: user.notes ?? undefined,
      })
      .single();

    if (updateError || !upUser) {
      error = updateError?.message || "Du hast keine Berechtigung, diesen Benutzer zu aktualisieren.";
      console.error("Error updating user:", updateError, upUser);
      return;
    }

    users = users.map((u) => (u.email === user.email ? upUser : u));
  }

  async function deleteUser(email: string) {
    error = null;
    const { error: deleteError } = await supabase.rpc("delete_allowed_user", {
      p_target_email: email,
    });

    if (deleteError) {
      error = deleteError.message || "Du hast keine Berechtigung, diesen Benutzer zu löschen.";
      console.error("Error deleting user:", deleteError);
      return;
    }

    users = users.filter((user) => user.email !== email);
  }

  async function createUser() {
    if (!newUserData.user || !newUserData.user.email) return;
    newUserData.modalOpen = false;
    error = null;
    loading = true;
    const { data: newUser, error: createError } = await supabase
      .rpc("insert_allowed_user", {
        p_email: newUserData.user.email,
        p_role: newUserData.user.role ?? "user",
        p_notes: newUserData.user.notes ?? undefined,
      })
      .single();

    if (createError) {
      error = createError.message || "Benutzer konnte nicht erstellt werden.";
      console.error("Error creating user:", createError);
      loading = false;
      return;
    }

    users.push(newUser);
    newUserData.user = null;
    loading = false;
  }

  onMount(async () => {
    const { data, error: fetchError } = await supabase
      .from("allowed_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching users:", fetchError);
      error = "Benutzer konnten nicht geladen werden.";
    } else {
      users = data || [];
    }
    loading = false;
  });
</script>

{#if !page.data.isAdmin && showNotAdminNote}
  <div class="dy-alert dy-alert-warning mb-4" transition:fade={{ duration: 150 }}>
    <span class="dy-alert-message">Du hast keine Berechtigung, Benutzer zu verwalten.</span>
    <button
      class="dy-btn dy-btn-square dy-btn-outline ml-auto size-7"
      onclick={() => (showNotAdminNote = false)}
    >
      <XIcon class="size-5" />
    </button>
  </div>
{/if}

<div class="mx-auto flex flex-row">
  <h1 class="mb-4 text-2xl font-bold">Benutzerverwaltung</h1>
  <button
    class="dy-btn dy-btn-secondary ml-auto"
    class:hidden={!page.data.isAdmin}
    onclick={openCreateUserModal}>Benutzer hinzufügen</button
  >
</div>

<div class="mx-auto overflow-x-auto">
  {#if error}
    <div class="dy-alert dy-alert-error">
      <span class="dy-alert-message">{error}</span>
    </div>
  {/if}
  <table class="dy-table">
    <thead>
      <tr>
        <th class="w-1/4">E-Mail</th>
        <th>Rolle</th>
        <th>Erstellt am</th>
        <th>Notizen</th>
        <th class:hidden={!page.data.isAdmin}>Aktionen</th>
      </tr>
    </thead>
    <tbody>
      {#if !loading && users.length === 0}
        <tr>
          <td colspan="5" class="text-center">Keine Benutzer gefunden.</td>
        </tr>
      {:else if loading}
        <tr>
          <td colspan="5" class="text-center">Laden...</td>
        </tr>
      {:else if users.length > 0}
        {#each users as user}
          <tr class="transition duration-75 hover:bg-(--color-light-base-100)">
            <td>{user.email}</td>
            <td><pre>{user.role}</pre></td>
            <td>{formatGermanDateTime(user.created_at)}</td>
            <td>{@html (user.notes || "Keine Notizen").replace(/\n/g, "<br />")}</td>
            <td class:hidden={!page.data.isAdmin}>
              <button
                class="dy-btn dy-btn-sm dy-btn-primary"
                onclick={() => {
                  selectUser.user = $state.snapshot(user);
                  selectUser.modalOpen = true;
                }}
              >
                Bearbeiten
              </button>
              <button
                class="dy-btn dy-btn-sm dy-btn-error"
                onclick={async () => {
                  if (confirm(`Bist du sicher, dass du diesen Benutzer löschen möchtest?\nE-Mail: ${user.email}`)) {
                    await deleteUser(user.email);
                  }
                }}
              >
                Löschen
              </button>
            </td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

<Modal
  bind:open={newUserData.modalOpen}
  title="Benutzer hinzufügen"
  onClose={() => {
    newUserData.user = null;
  }}
>
  <div class="flex flex-col items-center gap-4">
    {#if newUserData.user}
      <fieldset class="dy-fieldset w-full max-w-xs">
        <legend class="dy-fieldset-legend">Benutzer E-Mail</legend>
        <label class="dy-input dy-validator dy-join-item">
          <svg class="h-[1em] opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <g
              stroke-linejoin="round"
              stroke-linecap="round"
              stroke-width="2.5"
              fill="none"
              stroke="currentColor"
            >
              <rect width="20" height="16" x="2" y="4" rx="2"></rect>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
            </g>
          </svg>
          <input
            bind:value={newUserData.user.email}
            type="email"
            name="email"
            placeholder="user@gmail.com"
            required
            autocomplete="email"
          />
        </label>
        <div class="dy-validator-hint hidden">Gültige E-Mail-Adresse eingeben</div>
      </fieldset>
      <fieldset class="dy-fieldset w-full max-w-xs">
        <legend class="dy-fieldset-legend">Rolle</legend>
        <select name="role" class="dy-select" bind:value={newUserData.user.role}>
          <option value="user">Benutzer</option>
          <option value="editor">Redakteur</option>
          <option value="admin">Administrator</option>
        </select>
        <ul class="list-inside list-disc text-xs opacity-70">
          <li>Ein <strong>Redakteur</strong> kann nur Konzerte, Veranstaltungsorte und Songs verwalten.</li>
          <li><strong>Benutzer</strong> haben momentan keine Funktion.</li>
        </ul>
      </fieldset>
      <fieldset class="dy-fieldset w-full max-w-xs">
        <legend class="dy-fieldset-legend">Notizen</legend>
        <textarea name="notes" class="dy-textarea max-h-32" placeholder="Optionale Notizen über den Benutzer"
        ></textarea>
      </fieldset>
    {/if}
    <div class="flex w-full justify-center">
      <button class="dy-btn dy-btn-primary w-1/2" onclick={createUser}>Benutzer erstellen</button>
    </div>
  </div>
</Modal>

<Modal
  bind:open={selectUser.modalOpen}
  title="Benutzer bearbeiten"
  onClose={() => {
    if (!selectUser.modalOpen) {
      selectUser.user = null;
    }
  }}
>
  {#if selectUser.user}
    <div class="flex flex-col items-center gap-4">
      <fieldset class="dy-fieldset w-full max-w-xs">
        <legend class="dy-fieldset-legend">Benutzer bearbeiten</legend>
        <label class="dy-floating-label">
          <div class="dy-input">{selectUser.user.email}</div>
          <input type="hidden" name="email" value={selectUser.user.email} />
        </label>
      </fieldset>

      <fieldset class="dy-fieldset w-full max-w-xs">
        <legend class="dy-fieldset-legend">Rolle</legend>
        <select name="role" bind:value={selectUser.user.role} class="dy-select">
          <option value="user">Benutzer</option>
          <option value="editor">Redakteur</option>
          <option value="admin">Administrator</option>
        </select>
        <ul class="list-inside list-disc text-xs opacity-70">
          <li>Ein <strong>Redakteur</strong> kann nur Konzerte, Veranstaltungsorte und Songs verwalten.</li>
          <li><strong>Benutzer</strong> haben momentan keine Funktion.</li>
        </ul>
      </fieldset>

      <fieldset class="dy-fieldset w-full max-w-xs">
        <legend class="dy-fieldset-legend">Notizen</legend>
        <textarea
          name="notes"
          bind:value={selectUser.user.notes}
          class="dy-textarea h-24 resize-none"
          placeholder="Optionale Notizen über den Benutzer"
        ></textarea>
      </fieldset>

      <button
        class="dy-btn dy-btn-sm dy-btn-secondary"
        onclick={async () => {
          if (!selectUser.user) return;
          await updateUser($state.snapshot(selectUser.user));
          selectUser.modalOpen = false;
          selectUser.user = null;
          loading = false;
        }}
      >
        Speichern
      </button>
    </div>
  {/if}
</Modal>
