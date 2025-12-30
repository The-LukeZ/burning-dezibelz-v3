import { supabase } from "$lib/supabaseClient";

export const load = async ({ depends }) => {
  depends("supabase:auth");

  /**
   * It's fine to use `getSession` here, because on the client, `getSession` is
   * safe, and on the server, it reads `session` from the `LayoutData`, which
   * safely checked the session using `safeGetSession`.
   */
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return { supabase, session };
};
