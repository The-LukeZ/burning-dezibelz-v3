import { redirect } from "@sveltejs/kit";

export async function load({ locals, url, parent }) {
  const data = await parent();
  if (!locals.user || !locals.session) {
    return { isAdmin: false };
  }

  if (url.searchParams.has("next")) {
    console.debug("Redirecting to next:", url.searchParams.get("next"));
    redirect(303, url.searchParams.get("next")!);
  }

  return {
    isAdmin: data.isAdmin || locals.isAdmin,
    session: locals.session,
    user: locals.user,
  };
}
