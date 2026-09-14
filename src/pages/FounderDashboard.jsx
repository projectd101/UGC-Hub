import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/AuthContext";
import styles from "./Dashboard.module.css";

export default function FounderDashboard() {
  const { signOut } = useAuth();
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unlocks, setUnlocks] = useState({}); // creator_id -> contact string
  const [unlocking, setUnlocking] = useState(null);

  useEffect(() => {
    supabase
      .from("creators_public")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setCreators(data || []);
        setLoading(false);
      });
  }, []);

  async function handleUnlock(creatorId) {
    setUnlocking(creatorId);
    // Dummy amount for now — a real flow would let the founder pick/confirm
    // an amount before this call, matching what the creator asks for.
    const { data, error } = await supabase.rpc("fake_unlock_creator", {
      p_creator_id: creatorId,
      p_amount_cents: 5000,
    });

    if (!error) {
      const { data: contact } = await supabase.rpc("get_creator_contact", {
        p_creator_id: creatorId,
      });
      setUnlocks((prev) => ({ ...prev, [creatorId]: contact }));
    }
    setUnlocking(null);
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <span className={styles.logo}>UGC Hub</span>
        <button className={styles.signOut} onClick={signOut}>
          Sign out
        </button>
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>Browse creators</h1>
        <p className={styles.subtitle}>
          Unlock a profile to see their contact info and reach out directly.
        </p>

        {loading && <p className={styles.dim}>Loading…</p>}

        {!loading && creators.length === 0 && (
          <p className={styles.dim}>
            No creators yet — check back soon, or be the first to post a
            request once that's live.
          </p>
        )}

        <div className={styles.grid}>
          {creators.map((c) => {
            const contact = unlocks[c.id];
            return (
              <div key={c.id} className={styles.creatorCard}>
                <h3>{c.display_name}</h3>
                {c.bio && <p className={styles.bio}>{c.bio}</p>}

                {c.reactions?.length > 0 && (
                  <div className={styles.pillRow}>
                    {c.reactions.map((r) => (
                      <span key={r} className={styles.pill}>
                        {r}
                      </span>
                    ))}
                  </div>
                )}

                {c.niches?.length > 0 && (
                  <div className={styles.pillRow}>
                    {c.niches.map((n) => (
                      <span key={n} className={`${styles.pill} ${styles.pillViolet}`}>
                        {n}
                      </span>
                    ))}
                  </div>
                )}

                {contact ? (
                  <div className={styles.unlockedBox}>
                    <span className={styles.unlockedLabel}>Contact</span>
                    <span>{contact || "No contact info listed"}</span>
                  </div>
                ) : (
                  <button
                    className={styles.unlockBtn}
                    onClick={() => handleUnlock(c.id)}
                    disabled={unlocking === c.id}
                  >
                    {unlocking === c.id ? "Unlocking…" : "Pay $50 to unlock contact"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
