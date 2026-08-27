import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-intro">
      <div className="home-intro__copy">
        <p className="page-kicker">Personal music archive</p>
        <h1 className="display-title">A record of listening.</h1>
        <p className="lede">
          Needle is built around albums you spent meaningful time with — a collection for remembering,
          browsing, and finding your way back.
        </p>
      </div>

      <div className="home-intro__footer">
        <p className="home-intro__note">
          The archive interface is now taking shape. Real listening-history stories will appear only after
          the final import is reconciled; this shell does not invent placeholder history.
        </p>
        <Link className="text-link" href="/library">
          Enter the library
        </Link>
      </div>
    </main>
  );
}
