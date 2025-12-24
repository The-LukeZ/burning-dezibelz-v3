import devtoolsJson from "vite-plugin-devtools-json";
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { sentrySvelteKit } from "@sentry/sveltekit";

export default defineConfig({
  plugins: [
    sentrySvelteKit({
      sourceMapsUploadOptions: {
        org: "lukez-dev",
        project: "burning-dezibelz",
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
      adapter: "cloudflare",
      autoInstrument: true,
      autoUploadSourceMaps: true, 
    }),
    tailwindcss(),
    sveltekit(),
    devtoolsJson(),
  ],
});
