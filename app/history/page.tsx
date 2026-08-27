import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "History",
};

export default function HistoryPage() {
  return (
    <main className="page">
      <p className="page-kicker">Understand the archive over time</p>
      <section className="route-intro">
        <div>
          <h1 className="page-title">History</h1>
          <p className="lede">
            Listening history organized around records, returns, and time — not a stream of raw track-play statistics.
          </p>
        </div>
        <aside className="route-intro__aside">
          <span className="route-intro__status">Phase 4 surface</span>
          <p>
            Chronology will stay album-art-forward. Quantitative views remain supporting material rather than the page itself.
          </p>
        </aside>
      </section>
    </main>
  );
}
