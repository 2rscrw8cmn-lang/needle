export default function HomePage() {
  return (
    <main className="shell">
      <div className="eyebrow">Needle / Phase 1</div>
      <h1>Foundation online.</h1>
      <p>
        This screen only verifies the Next.js-compatible app shell on Cloudflare Workers.
        Product UI starts after the data foundation is trustworthy.
      </p>
      <a href="/api/health">Check runtime + D1 health</a>
    </main>
  );
}
