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

function WalletIcon() {
  return <span className={styles.walletGlyph} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 7h14.5A2.5 2.5 0 0 1 21 9.5v5H16a2.5 2.5 0 0 1 0-5h5"/><circle cx="16" cy="12" r=".7" fill="currentColor" stroke="none"/></svg></span>;
}

function CreatorSkeleton() {
  return (
    <div className={styles.creatorCard} aria-hidden="true">
      <div className={styles.skeletonLine} />
      <div className={`${styles.skeletonLine} ${styles.skeletonLineWide}`} />
      <div className={styles.skeletonPills}><span /><span /><span /></div>
      <div className={styles.skeletonMeta}><span /><span /></div>
      <div className={styles.skeletonButton} />
    </div>
  );
}

export default function CreatorDashboard() {
  const { user, signOut } = useAuth();
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: creatorRow } = await supabase.from("creators").select("*").eq("user_id", user.id).maybeSingle();
      setCreator(creatorRow);
      setLoading(false);
    }
    load();
  }, [user.id]);

  function closePanels() {
    setDrawerOpen(false);
    setNotificationsOpen(false);
    setWalletOpen(false);
    setActivePanel(null);
  }

  function openMenu(panel = null) {
    setNotificationsOpen(false);
    setWalletOpen(false);
    setDrawerOpen(true);
    setActivePanel(panel);
  }

  function handleDeleteAccount() {
    const confirmed = window.confirm("Delete your UGC Hub account? This action cannot be undone.");
    if (confirmed) window.alert("Account deletion is not connected yet. No account was deleted.");
  }

  return (
    <div className={styles.wrap}>
      {(drawerOpen || notificationsOpen || walletOpen) && <button className={styles.backdrop} aria-label="Close" onClick={closePanels} />}

      <header className={styles.header}>
        <a href="/" className={`${styles.logo} ugcBrandMark`} aria-label="UGC Hub home">
          <span className="ugcBrandMark__ugc">UGC</span><span className="ugcBrandMark__hub">Hub</span>
        </a>
        <div className={styles.headerActions}>
          <button className={styles.iconButton} aria-label="Wallet" aria-expanded={walletOpen} onClick={() => { closePanels(); setWalletOpen(true); }}><WalletIcon /></button>
          <button className={styles.iconButton} aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { closePanels(); setNotificationsOpen(true); }}><BellIcon /><span className={styles.notificationDot} /></button>
          <button className={styles.iconButton} aria-label="Account menu" aria-expanded={drawerOpen} onClick={() => (drawerOpen ? closePanels() : openMenu())}><MenuIcon /></button>
          <button className={styles.signOut} onClick={signOut}>Sign out</button>
        </div>
      </header>

      {walletOpen && (
        <aside className={styles.notificationPanel} aria-label="Wallet">
          <div className={styles.panelHeader}>
            <div><span className={styles.panelEyebrow}>Creator earnings</span><h2>Wallet</h2></div>
            <button className={styles.closeButton} onClick={closePanels} aria-label="Close wallet">×</button>
          </div>
          <div className={styles.walletBalance}>
            <span>Available balance</span><strong>$0.00</strong>
            <small>Earnings and payout status will appear here once your reaction library generates revenue.</small>
          </div>
          <button className={styles.walletAction} onClick={() => { setWalletOpen(false); openMenu("payouts"); }}>Set up payouts</button>
        </aside>
      )}

      {notificationsOpen && (
        <aside className={styles.notificationPanel} aria-label="Notifications">
          <div className={styles.panelHeader}>
            <div><span className={styles.panelEyebrow}>Updates</span><h2>Notifications</h2></div>
            <button className={styles.closeButton} onClick={closePanels} aria-label="Close notifications">×</button>
          </div>
          <div className={styles.emptyState}><BellIcon /><strong>You're all caught up</strong><span>New founder activity, library updates and payout notifications will appear here.</span></div>
        </aside>
      )}

      <aside className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ""}`} aria-hidden={!drawerOpen}>
        <div className={styles.drawerHeader}>
          <div><span className={styles.panelEyebrow}>Creator account</span><h2>Menu</h2></div>
          <button className={styles.closeButton} onClick={closePanels} aria-label="Close menu">×</button>
        </div>
        <div className={styles.accountCard}>
          <div className={styles.accountAvatar}>{(creator?.display_name || user?.email || "C").charAt(0).toUpperCase()}</div>
          <div><strong>{creator?.display_name || "Creator"}</strong><span>{user?.email || "Creator account"}</span></div>
        </div>
        <nav className={styles.drawerNav}>
          <button className={styles.drawerItem} onClick={() => setActivePanel("profile")}><span>Account information</span><b>›</b></button>
          <button className={styles.drawerItem} onClick={() => setActivePanel("history")}><span>History</span><b>›</b></button>
          <button className={styles.drawerItem} onClick={() => setActivePanel("payouts")}><span>Payouts</span><b>›</b></button>
        </nav>
        {activePanel && (
          <div className={styles.drawerDetail}>
            <span className={styles.panelEyebrow}>{activePanel === "profile" ? "Account" : activePanel === "history" ? "Activity" : "Payments"}</span>
            <h3>{activePanel === "profile" ? "Account information" : activePanel === "history" ? "History" : "Payouts"}</h3>
            <p>{activePanel === "profile" ? "Your creator account details and public profile settings will live here." : activePanel === "history" ? "Your library activity, uploads and account history will appear here." : "Set up how UGC Hub should send your earnings. Your payout method will be stored securely when payments are connected."}</p>
            {activePanel === "payouts" && <button className={styles.walletAction}>Set up payout method</button>}
          </div>
        )}
        <div className={styles.drawerFooter}>
          <button className={`${styles.drawerItem} ${styles.deleteItem}`} onClick={handleDeleteAccount}><span>Delete account</span><b>›</b></button>
        </div>
      </aside>

      <main className={styles.main}>
        {creator && <div className={styles.profileSummary}><div><h1 className={styles.title}>{creator.display_name}</h1><p className={styles.subtitle}>Your creator library is live to founders.</p></div><span className={styles.activeBadge}>Active</span></div>}
        <h2 className={styles.sectionTitle}>Your creator library</h2>
        {loading && <div className={styles.grid} aria-label="Loading creator library"><CreatorSkeleton /><CreatorSkeleton /><CreatorSkeleton /></div>}
        {!loading && !creator && <div className={styles.emptyCreatorState}><strong>Creator profile not found</strong><span>Your creator account details will appear here once your profile is active.</span></div>}
        {!loading && creator && <div className={styles.grid}><div className={styles.creatorCard}><h3>{creator.display_name}</h3>{creator.bio && <p className={styles.bio}>{creator.bio}</p>}{creator.reactions?.length > 0 && <div className={styles.pillRow}>{creator.reactions.map((reaction) => <span key={reaction} className={styles.pill}>{reaction}</span>)}</div>}{creator.niches?.length > 0 && <div className={styles.pillRow}>{creator.niches.map((niche) => <span key={niche} className={`${styles.pill} ${styles.pillViolet}`}>{niche}</span>)}</div>}<div className={styles.libraryMeta}><span>Founder visibility</span><strong>Active</strong></div></div></div>}
      </main>
    </div>
  );
}
