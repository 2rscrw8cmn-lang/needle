import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Library",
};

export default function LibraryPage() {
  return (
    <main className="page">
      <p className="page-kicker">Find and inspect</p>
      <section className="route-intro">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="lede">
            The complete working collection — artwork first, fast to scan, and grounded in meaningful album listens.
          </p>
        </div>
        <aside className="route-intro__aside">
          <span className="route-intro__status">Next / 2.02–2.03</span>
          <p>
            The artwork system and real cover wall arrive next. This route is intentionally empty until those pieces exist.
          </p>
        </aside>
      </section>
    </main>
  );
}
