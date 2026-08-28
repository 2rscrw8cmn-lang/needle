import { env } from "cloudflare:workers";
import Link from "next/link";

import { HomeIssue } from "./components/home-issue";
import {
  homeIssueNumber,
  loadHome,
  resolveHomeIssueIndex,
  type HomeView,
} from "../lib/home/home";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let home: HomeView;
  try {
    home = await loadHome(env.DB);
  } catch {
    return <HomeUnavailable />;
  }

  if (!home.featured) return <HomeEmpty />;

  const now = new Date();
  return (
    <HomeIssue
      home={home}
      initialIssueIndex={resolveHomeIssueIndex(now)}
      issueNumber={homeIssueNumber(now)}
      issueDate={new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }).format(now)}
    />
  );
}

function HomeEmpty() {
  return (
    <main className={`${styles.homeState} home-shell`}>
      <p className={styles.stateRule}>The archive is ready for its first issue once meaningful album history is loaded.</p>
      <Link href="/library">Import / open the Library →</Link>
    </main>
  );
}

function HomeUnavailable() {
  return (
    <main className={`${styles.homeState} home-shell`}>
      <p className={styles.localError}>Archive unavailable · Needle could not read the current D1 archive.</p>
      <Link href="/library">Open the Library →</Link>
    </main>
  );
}
