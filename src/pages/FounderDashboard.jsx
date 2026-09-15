import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/AuthContext";
import styles from "./Dashboard.module.css";

function MenuIcon() {
  return <span className={styles.menuGlyph} aria-hidden="true"><i /><i /><i /></span>;
}

function BellIcon() {
  return <span className={styles.bellGlyph} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span>;
}

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

export default function FounderDashboard() {
  const { signOut, user, profile } = useAuth();
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);

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

  function openMenu(panel = null) {
    setNotificationsOpen(false);
    setDrawerOpen(true);
    setActivePanel(panel);
  }

  function closePanels() {
    setDrawerOpen(false);
    setNotificationsOpen(false);
    setActivePanel(null);
  }

  function handleDeleteAccount() {
    const confirmed = window.confirm(
      "Delete your UGC Hub account? This action cannot be undone."
    );
    if (confirmed) {
      window.alert("Account deletion is not connected yet. No account was deleted.");
    }
  }

  return (
    <div className={styles.wrap}>
      {(drawerOpen || notificationsOpen) && (
        <button className={styles.backdrop} aria-label="Close" onClick={closePanels} />
      )}

      <header className={styles.header}>
        <a href="/" className={`${styles.logo} ugcBrandMark`} aria-label="UGC Hub home">
          <span className="ugcBrandMark__ugc">UGC</span>
          <span className="ugcBrandMark__hub">Hub</span>
        </a>
        <div className={styles.headerActions}>
          <button
            className={styles.iconButton}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => {
              setDrawerOpen(false);
              setNotificationsOpen((open) => !open);
            }}
          >
            <BellIcon />
            <span className={styles.notificationDot} />
          </button>
          <button
            className={styles.iconButton}
            aria-label="Account menu"
            aria-expanded={drawerOpen}
            onClick={() => (drawerOpen ? closePanels() : openMenu())}
          >
            <MenuIcon />
          </button>
          <button className={styles.signOut} onClick={signOut}>Sign out</button>
        </div>
      </header>

      {notificationsOpen && (
        <aside className={styles.notificationPanel} aria-label="Notifications">
          <div className={styles.panelHeader}>
            <div><span className={styles.panelEyebrow}>Updates</span><h2>Notifications</h2></div>
            <button className={styles.closeButton} onClick={closePanels} aria-label="Close notifications">×</button>
          </div>
          <div className={styles.emptyState}>
            <BellIcon />
            <strong>You're all caught up</strong>
            <span>New creator activity and account updates will appear here.</span>
          </div>
        </aside>
      )}

      <aside className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ""}`} aria-hidden={!drawerOpen}>
        <div className={styles.drawerHeader}>
          <div><span className={styles.panelEyebrow}>Founder account</span><h2>Menu</h2></div>
          <button className={styles.closeButton} onClick={closePanels} aria-label="Close menu">×</button>
        </div>

        <div className={styles.accountCard}>
          <div className={styles.accountAvatar}>{(profile?.display_name || user?.email || "F").charAt(0).toUpperCase()}</div>
          <div><strong>{profile?.display_name || "Founder"}</strong><span>{user?.email || "Founder account"}</span></div>
        </div>

        <nav className={styles.drawerNav}>
          <button className={styles.drawerItem} onClick={() => setActivePanel("profile")}><span>Profile information</span><b>›</b></button>
          <button className={styles.drawerItem} onClick={() => setActivePanel("history")}><span>History</span><b>›</b></button>
          <button className={styles.drawerItem} onClick={() => setActivePanel("saves")}><span>Saves</span><b>›</b></button>
        </nav>

        {activePanel && (
          <div className={styles.drawerDetail}>
            <span className={styles.panelEyebrow}>{activePanel === "profile" ? "Account" : activePanel === "history" ? "Activity" : "Library"}</span>
            <h3>{activePanel === "profile" ? "Profile information" : activePanel === "history" ? "History" : "Saves"}</h3>
            <p>{activePanel === "profile" ? "Your founder account details will live here." : activePanel === "history" ? "Your creator library browsing and activity history will appear here." : "Creators and reaction libraries you save will appear here."}</p>
          </div>
        )}

        <div className={styles.drawerFooter}>
          <button className={`${styles.drawerItem} ${styles.deleteItem}`} onClick={handleDeleteAccount}><span>Delete account</span><b>›</b></button>
        </div>
      </aside>

      <main className={styles.main}>
        <h1 className={styles.title}>Browse creators</h1>
        <p className={styles.subtitle}>Browse creator reaction libraries. Once creators are active, their available content will appear here — no founder-side unlocks or payments.</p>

        {loading && (
          <div className={styles.grid} aria-label="Loading creators">
            <CreatorSkeleton />
            <CreatorSkeleton />
            <CreatorSkeleton />
            <CreatorSkeleton />
          </div>
        )}

        {!loading && creators.length === 0 && (
          <div className={styles.emptyCreatorState}>
            <div className={styles.emptyCreatorIcon} />
            <strong>No creator libraries yet</strong>
            <span>Creator libraries will appear here automatically once creators are active.</span>
          </div>
        )}

        {!loading && creators.length > 0 && (
          <div className={styles.grid}>
            {creators.map((c) => (
              <div key={c.id} className={styles.creatorCard}>
                <h3>{c.display_name}</h3>
                {c.bio && <p className={styles.bio}>{c.bio}</p>}
                {c.reactions?.length > 0 && <div className={styles.pillRow}>{c.reactions.map((r) => <span key={r} className={styles.pill}>{r}</span>)}</div>}
                {c.niches?.length > 0 && <div className={styles.pillRow}>{c.niches.map((n) => <span key={n} className={`${styles.pill} ${styles.pillViolet}`}>{n}</span>)}</div>}
                <div className={styles.libraryMeta}>
                  <span>Reaction library</span>
                  <strong>Available</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
