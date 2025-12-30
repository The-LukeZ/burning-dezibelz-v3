<script lang="ts">
  import Head from "$lib/components/Head.svelte";
</script>

<Head
  seo_config={{
    title: "Datenschutz | Burning Dezibelz",
    description: "Datenschutzbestimmungen der Burning Dezibelz",
    url: "https://burningdezibelz.de/datenschutz",
    author_name: "Burning Dezibelz",
    language: "de",
  }}
/>

<div class="dy-prose mx-auto w-full max-w-250 items-center justify-between p-4 py-5">
  <h1 class="text-3xl font-bold">Datenschutz</h1>
  <span class="dy-divider"></span>
  <article class="prose">
    <section>
      <h2>1. Allgemeine Hinweise</h2>
      <p>
        Der Schutz Ihrer persönlichen Daten ist uns ein wichtiges Anliegen. Nachfolgend informieren wir Sie darüber, wie wir Daten auf unserer Website verarbeiten.
      </p>
    </section>

    <section>
      <h2>2. Hosting und Content Delivery Networks (CDN)</h2>
      <h3>Cloudflare</h3>
      <p>
        Unsere Website wird bei Cloudflare gehostet. Um die Website auszuliefern, verarbeitet Cloudflare technische Informationen wie Ihre IP-Adresse, den verwendeten Browser und Zugriffszeiten. Diese Daten sind technisch notwendig, um die Website anzuzeigen und die Sicherheit zu gewährleisten. Weitere Informationen finden Sie in der <a href="https://www.cloudflare.com/privacypolicy/">Datenschutzerklärung von Cloudflare</a>.
      </p>
      <h3>Cloudflare R2</h3>
      <p>
        Für die Auslieferung von Bildern nutzen wir Cloudflare R2. Auch hierbei können technische Verbindungsdaten (wie Ihre IP-Adresse) verarbeitet werden, um die Inhalte abzurufen.
      </p>
      <h3>Cloudflare Turnstile</h3>
      <p>
        Zum Schutz unserer Website vor Spam und Missbrauch setzen wir Cloudflare Turnstile beim internen Login ein. Dabei werden technische Daten wie Ihre IP-Adresse und Browserinformationen an Cloudflare übermittelt, um die Interaktion zu bewerten. Weitere Informationen finden Sie in der <a href="https://www.cloudflare.com/privacypolicy/">Datenschutzerklärung von Cloudflare</a>.
      </p>
    </section>

    <section>
      <h2>3. Fehleranalyse mit Sentry</h2>
      <p>
        Wir verwenden den Dienst Sentry (sentry.io, Functional Software, Inc.), um technische Fehler auf unserer Website zu erkennen und zu beheben.
      </p>
      <p>
        Im Falle eines Absturzes oder Fehlers werden Informationen an Sentry übertragen. Dazu gehören technische Daten wie Betriebssystem, Browserversion und ggf. die IP-Adresse. Diese Daten werden ausschließlich zur technischen Analyse und Verbesserung der Website-Stabilität genutzt. Weitere Informationen finden Sie in der <a href="https://sentry.io/privacy/">Datenschutzerklärung von Sentry</a>.
      </p>
    </section>

    <section>
      <h2>4. Nutzung von Supabase</h2>
      <p>
        Unsere Website nutzt Supabase als Backend-Dienstleister und Datenbank. Supabase verarbeitet Daten gemäß ihrer <a href="https://supabase.com/privacy">Datenschutzerklärung</a>.
      </p>
    </section>

    <section>
      <h2>5. Verarbeitung personenbezogener Daten</h2>
      <p>
        Sie haben die Möglichkeit, beim Kontaktformular personenbezogene Daten wie die E-Mail-Adresse anzugeben. Diese Daten werden ausschließlich zur Bearbeitung Ihrer Anfrage verwendet und nicht an Dritte weitergegeben. Dies trifft auch auf den Betreff und die Nachricht zu, die Sie uns über das Kontaktformular senden.
      </p>
      <p>
        Die Verarbeitung dieser Daten erfolgt auf Grundlage Ihrer Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO. Sie können Ihre Einwilligung jederzeit widerrufen, indem Sie uns kontaktieren.
      </p>
    </section>

    <section>
      <h2>4. Interner Bereich & Authentifizierung</h2>
      <p>
        Unsere Website verfügt über einen internen Bereich, der ausschließlich für autorisierte Mitglieder der Band bestimmt ist. Man kann sich mittels Email + Passwort, Magic Link oder Google OAuth anmelden.
      </p>
      <h3>Google OAuth</h3>
      <p>
        Für den Zugang zum internen Bereich nutzen wir die Authentifizierung über Google. Wenn Sie sich als autorisiertes Mitglied anmelden, erhalten wir von Google folgende Daten:
      </p>
      <ul class="list-inside list-disc">
        <li>E-Mail-Adresse</li>
        <li>Name</li>
        <li>Profilbild</li>
      </ul>
      <p>
        Diese Daten dienen ausschließlich der Identifikation und Autorisierung für den Verwaltungsbereich. Ein Login für externe Besucher ist nicht vorgesehen und technisch unterbunden.
      </p>
    </section>

    <section>
      <h2>5. Kontakt</h2>
      <p>
        Bei Fragen zum Datenschutz können Sie uns über die im <a href="/impressum">Impressum</a> angegebenen Kontaktdaten erreichen.
      </p>
    </section>
  </article>
</div>

<style>
  article {
    color: var(--color-gray-300);
    > *:not(:first-child) {
      margin-top: 1rem;
    }
    > *:not(:last-child) {
      margin-bottom: 1rem;
    }
  }

  h1,
  h2,
  h3 {
    color: var(--color-base-content);
    font-weight: var(--font-weight-semibold);
  }

  h1 {
    font-size: var(--text-2xl);
    font-weight: var(--font-weight-bold);
  }

  h2 {
    font-size: var(--text-xl);
  }

  h3 {
    font-size: var(--text-lg);
  }

  ul {
    padding-left: 1.5rem;
  }
</style>
