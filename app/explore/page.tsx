import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore",
};

export default function ExplorePage() {
  return (
    <main className="page">
      <p className="page-kicker">Browse without a target</p>
      <section className="route-intro">
        <div>
          <h1 className="page-title">Explore</h1>
          <p className="lede">
            Move through the collection by Music Type, genre, artist, release era, and historically grounded slices.
          </p>
        </div>
        <aside className="route-intro__aside">
          <span className="route-intro__status">Phase 3 surface</span>
          <p>
            Explore shares the same shell now so later artwork-led browsing can arrive without another navigation redesign.
          </p>
        </aside>
      </section>
    </main>
  );
}
