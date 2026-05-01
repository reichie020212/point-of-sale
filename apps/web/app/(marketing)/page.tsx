import Link from 'next/link';

export default function LandingPage() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24">
      <p className="mb-6 inline-block rounded-pill bg-accent-soft px-3 py-1 text-sm text-accent-deep">
        Counter
      </p>
      <h1 className="font-display text-5xl text-ink md:text-6xl">
        A calm point-of-sale for <em className="text-accent-deep">small shops</em>.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-ink-2">
        Offline-first register on Android &amp; iOS, plus a back-office on the web.
        Sales never block on a network call. Sync is the only paywall.
      </p>
      <div className="mt-10 flex gap-3">
        <Link
          href="/sign-up"
          className="rounded-xl bg-ink px-5 py-3 font-medium text-bg shadow-card hover:bg-ink-2"
        >
          Get started
        </Link>
        <Link
          href="/sign-in"
          className="rounded-xl border border-line-2 px-5 py-3 font-medium text-ink hover:bg-surface-2"
        >
          Sign in
        </Link>
      </div>
      <p className="mt-12 font-mono text-sm text-ink-3">
        v0.0.0 <span className="tabular">·</span> built from HANDOFF.md
      </p>
    </section>
  );
}
