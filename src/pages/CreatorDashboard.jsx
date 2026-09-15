import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/AuthContext";
import styles from "./Dashboard.module.css";

function CreatorSkeleton() {
  return (
    <div className={styles.creatorCard} aria-hidden="true">
      <div className={styles.skeletonLine} />
      <div className={`${styles.skeletonLine} ${styles.skeletonLineWide}`} />
      <div className={styles.skeletonPills}>
        <span /><span /><span />
      </div>
      <div className={styles.skeletonMeta}>
        <span />
        <span />
      </div>
      <div className={styles.skeletonButton} />
    </div>
  );
}

export default function CreatorDashboard() {
  const { user, signOut } = useAuth();
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: creatorRow } = await supabase
        .from("creators")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setCreator(creatorRow);
      setLoading(false);
    }
    load();
  }, [user.id]);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <a href="/" className={`${styles.logo} ugcBrandMark`} aria-label="UGC Hub home">
          <span className="ugcBrandMark__ugc">UGC</span>
          <span className="ugcBrandMark__hub">Hub</span>
        </a>
        <button className={styles.signOut} onClick={signOut}>
          Sign out
        </button>
      </header>

      <main className={styles.main}>
        {creator && (
          <div className={styles.profileSummary}>
            <div>
              <h1 className={styles.title}>{creator.display_name}</h1>
              <p className={styles.subtitle}>Your creator library is live to founders.</p>
            </div>
            <span className={styles.activeBadge}>Active</span>
          </div>
        )}

        <h2 className={styles.sectionTitle}>Your creator library</h2>

        {loading && (
          <div className={styles.grid} aria-label="Loading creator library">
            <CreatorSkeleton />
            <CreatorSkeleton />
            <CreatorSkeleton />
          </div>
        )}

        {!loading && !creator && (
          <div className={styles.emptyCreatorState}>
            <strong>Creator profile not found</strong>
            <span>Your creator account details will appear here once your profile is active.</span>
          </div>
        )}

        {!loading && creator && (
          <div className={styles.grid}>
            <div className={styles.creatorCard}>
              <h3>{creator.display_name}</h3>
              {creator.bio && <p className={styles.bio}>{creator.bio}</p>}
              {creator.reactions?.length > 0 && (
                <div className={styles.pillRow}>
                  {creator.reactions.map((reaction) => (
                    <span key={reaction} className={styles.pill}>{reaction}</span>
                  ))}
                </div>
              )}
              {creator.niches?.length > 0 && (
                <div className={styles.pillRow}>
                  {creator.niches.map((niche) => (
                    <span key={niche} className={`${styles.pill} ${styles.pillViolet}`}>{niche}</span>
                  ))}
                </div>
              )}
              <div className={styles.libraryMeta}>
                <span>Founder visibility</span>
                <strong>Active</strong>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
