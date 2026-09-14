import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/AuthContext";
import styles from "./Dashboard.module.css";

export default function CreatorDashboard() {
  const { user, signOut } = useAuth();
  const [creator, setCreator] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: creatorRow } = await supabase
        .from("creators")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setCreator(creatorRow);

      const { data: reqs } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });
      setRequests(reqs || []);
      setLoading(false);
    }
    load();
  }, [user.id]);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <span className={styles.logo}>UGC Hub</span>
        <button className={styles.signOut} onClick={signOut}>
          Sign out
        </button>
      </header>

      <main className={styles.main}>
        {creator && (
          <div className={styles.profileSummary}>
            <div>
              <h1 className={styles.title}>{creator.display_name}</h1>
              <p className={styles.subtitle}>Your profile is live to founders.</p>
            </div>
            <span className={styles.activeBadge}>Active</span>
          </div>
        )}

        <h2 className={styles.sectionTitle}>Open requests</h2>

        {loading && <p className={styles.dim}>Loading…</p>}

        {!loading && requests.length === 0 && (
          <p className={styles.dim}>
            No open requests yet. Founders will post here once they're
            live — check back soon.
          </p>
        )}

        <div className={styles.grid}>
          {requests.map((r) => (
            <div key={r.id} className={styles.requestCard}>
              <h3>{r.title}</h3>
              {r.description && <p className={styles.bio}>{r.description}</p>}
              {r.reactions_needed?.length > 0 && (
                <div className={styles.pillRow}>
                  {r.reactions_needed.map((rx) => (
                    <span key={rx} className={styles.pill}>
                      {rx}
                    </span>
                  ))}
                </div>
              )}
              {r.budget_cents && (
                <p className={styles.budget}>
                  Budget: ${(r.budget_cents / 100).toFixed(0)}
                </p>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
