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

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

const UNLOCK_PRICE_CENTS = 500; // $5 flat to unlock a creator's contact — dummy payment for now

export default function FounderDashboard() {
  const { signOut, user, profile } = useAuth();
  const [view, setView] = useState("creators"); // "creators" | "bundles" | "purchases"
  const [creators, setCreators] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [purchasedBundles, setPurchasedBundles] = useState([]); // [{ ...bundle, videos: [...] }]
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [unlockedContacts, setUnlockedContacts] = useState({}); // { [creatorId]: contactHandle }
  const [unlockingId, setUnlockingId] = useState(null);
  const [unlockError, setUnlockError] = useState(null);
  const [purchasedBundleIds, setPurchasedBundleIds] = useState(new Set());
  const [driveFolders, setDriveFolders] = useState({}); // { [bundleId]: { status, drive_folder_url } }
  const [buyingBundleId, setBuyingBundleId] = useState(null);
  const [buyError, setBuyError] = useState(null);

  useEffect(() => {
    Promise.all([
      supabase.from("creators_public").select("*").order("created_at", { ascending: false }),
      supabase.from("bundles_public").select("*").order("created_at", { ascending: false }),
      supabase.from("founders").select("id").eq("user_id", user.id).maybeSingle(),
    ]).then(async ([creatorsRes, bundlesRes, founderRes]) => {
      setCreators(creatorsRes.data || []);
      setBundles(bundlesRes.data || []);

      if (founderRes.data) {
        const founderId = founderRes.data.id;

        const { data: purchases } = await supabase
          .from("bundle_purchases")
          .select("bundle_id, created_at, bundles(id, name, description, price_cents, library_id, creator_id)")
          .eq("founder_id", founderId)
          .eq("status", "succeeded");

        setPurchasedBundleIds(new Set((purchases || []).map((p) => p.bundle_id)));

        // The Drive folder link ("download everything at once") is gated
        // entirely by RLS on bundle_drive_folders: this query simply
        // returns nothing for a bundle this founder hasn't paid for, no
        // matter what bundle_ids we ask for.
        const purchasedIds = (purchases || []).map((p) => p.bundle_id);
        if (purchasedIds.length) {
          const { data: folders } = await supabase
            .from("bundle_drive_folders")
            .select("bundle_id, status, drive_folder_url")
            .in("bundle_id", purchasedIds);
          const grouped = {};
          for (const row of folders || []) grouped[row.bundle_id] = row;
          setDriveFolders(grouped);
        }

        // For each purchased bundle, fetch the videos it actually grants
        // access to. RLS (see "founders can read videos in bundles they
        // purchased") is what actually enforces this — this query would
        // simply return nothing for a bundle the founder hasn't paid for.
        const withVideos = await Promise.all(
          (purchases || []).map(async (p) => {
            const bundle = p.bundles;
            if (!bundle) return null;

            let videoQuery = supabase.from("videos").select("id, name, filename, original_drive_url, processing_status");
            if (bundle.library_id) {
              const { data: lv } = await supabase.from("library_videos").select("video_id").eq("library_id", bundle.library_id);
              const videoIds = (lv || []).map((row) => row.video_id);
              if (!videoIds.length) return { ...bundle, videos: [] };
              videoQuery = videoQuery.in("id", videoIds);
            } else {
              videoQuery = videoQuery.eq("creator_id", bundle.creator_id);
            }

            const { data: videos } = await videoQuery;
            return { ...bundle, videos: videos || [] };
          })
        );

        setPurchasedBundles(withVideos.filter(Boolean));
      }

      setLoading(false);
    });
  }, [user.id]);

  async function handleBuyBundle(bundleId) {
    setBuyingBundleId(bundleId);
    setBuyError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      setBuyError("Your session expired. Please sign in again.");
      setBuyingBundleId(null);
      return;
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dodo-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ kind: "bundle", bundle_id: bundleId }),
        }
      );
      const body = await res.json();

      if (!res.ok || !body.checkout_url) {
        setBuyError(body.error || "Couldn't start checkout. Please try again.");
        setBuyingBundleId(null);
        return;
      }

      // Access is granted only once the webhook confirms payment — see
      // /founder/purchased handling in App.jsx for what happens on return.
      window.location.href = body.checkout_url;
    } catch {
      setBuyError("Couldn't reach the payment service. Please try again.");
      setBuyingBundleId(null);
    }
  }

  async function handleUnlock(creatorId) {
    setUnlockingId(creatorId);
    setUnlockError(null);

    const { error: rpcError } = await supabase.rpc("fake_unlock_creator", {
      p_creator_id: creatorId,
      p_amount_cents: UNLOCK_PRICE_CENTS,
    });

    if (rpcError) {
      setUnlockError("Couldn't unlock this creator. Please try again.");
      setUnlockingId(null);
      return;
    }

    const { data: contact } = await supabase.rpc("get_creator_contact", {
      p_creator_id: creatorId,
    });

    setUnlockedContacts((current) => ({ ...current, [creatorId]: contact || "No contact info on file" }));
    setUnlockingId(null);
  }

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
        <p className={styles.subtitle}>Browse creator reaction libraries and ready-to-buy bundles. Payments aren't connected yet — this is a preview of what's available.</p>

        <nav className={styles.creatorTabs} aria-label="Browse view">
          <button className={view === "creators" ? styles.creatorTabActive : styles.creatorTab} onClick={() => setView("creators")}>Creators <b>{creators.length}</b></button>
          <button className={view === "bundles" ? styles.creatorTabActive : styles.creatorTab} onClick={() => setView("bundles")}>Bundles <b>{bundles.length}</b></button>
          <button className={view === "purchases" ? styles.creatorTabActive : styles.creatorTab} onClick={() => setView("purchases")}>My purchases <b>{purchasedBundles.length}</b></button>
        </nav>

        {loading && (
          <div className={styles.grid} aria-label="Loading">
            <CreatorSkeleton />
            <CreatorSkeleton />
            <CreatorSkeleton />
            <CreatorSkeleton />
          </div>
        )}

        {!loading && view === "creators" && creators.length === 0 && (
          <div className={styles.emptyCreatorState}>
            <div className={styles.emptyCreatorIcon} />
            <strong>No creator libraries yet</strong>
            <span>Creator libraries will appear here automatically once creators are active.</span>
          </div>
        )}

        {!loading && view === "creators" && creators.length > 0 && (
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
                {unlockedContacts[c.id] ? (
                  <div className={styles.libraryMeta}>
                    <span>Contact</span>
                    <strong>{unlockedContacts[c.id]}</strong>
                  </div>
                ) : (
                  <button
                    className={styles.primaryAction}
                    onClick={() => handleUnlock(c.id)}
                    disabled={unlockingId === c.id}
                  >
                    {unlockingId === c.id ? "Unlocking…" : `Unlock contact · ${formatPrice(UNLOCK_PRICE_CENTS)}`}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {unlockError && <p style={{ color: "#c43f50", fontSize: 12.5, marginTop: 12 }}>{unlockError}</p>}

        {!loading && view === "bundles" && bundles.length === 0 && (
          <div className={styles.emptyCreatorState}>
            <div className={styles.emptyCreatorIcon} />
            <strong>No bundles published yet</strong>
            <span>Bundles will appear here once creators publish a priced clip package.</span>
          </div>
        )}

        {!loading && view === "bundles" && bundles.length > 0 && (
          <div className={styles.grid}>
            {bundles.map((b) => (
              <div key={b.id} className={styles.creatorCard}>
                <h3>{b.name}</h3>
                <p className={styles.bio}>by {b.creator_display_name}</p>
                {b.description && <p className={styles.bio}>{b.description}</p>}
                <div className={styles.libraryMeta}>
                  <span>{b.video_count} clips</span>
                  <strong>{formatPrice(b.price_cents)}</strong>
                </div>
                {purchasedBundleIds.has(b.id) ? (
                  <div className={styles.libraryMeta}>
                    <span>Purchased</span>
                    <strong>Ready to download</strong>
                  </div>
                ) : (
                  <button
                    className={styles.primaryAction}
                    onClick={() => handleBuyBundle(b.id)}
                    disabled={buyingBundleId === b.id}
                  >
                    {buyingBundleId === b.id ? "Starting checkout…" : `Buy bundle · ${formatPrice(b.price_cents)}`}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {buyError && <p style={{ color: "#c43f50", fontSize: 12.5, marginTop: 12 }}>{buyError}</p>}

        {!loading && view === "purchases" && purchasedBundles.length === 0 && (
          <div className={styles.emptyCreatorState}>
            <div className={styles.emptyCreatorIcon} />
            <strong>No purchases yet</strong>
            <span>Bundles you buy will appear here with download links for each clip.</span>
          </div>
        )}

        {!loading && view === "purchases" && purchasedBundles.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {purchasedBundles.map((bundle) => (
              <div key={bundle.id} className={styles.creatorCard}>
                <h3>{bundle.name}</h3>
                {bundle.description && <p className={styles.bio}>{bundle.description}</p>}
                <div className={styles.libraryMeta}><span>{bundle.videos.length} clips</span><strong>{formatPrice(bundle.price_cents)} paid</strong></div>
                {(() => {
                  const folder = driveFolders[bundle.id];
                  if (folder?.status === "ready" && folder.drive_folder_url) {
                    return (
                      <a
                        href={folder.drive_folder_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.primaryAction}
                        style={{ display: "inline-block", marginTop: 10, textAlign: "center", textDecoration: "none" }}
                      >
                        📁 Download all in Google Drive
                      </a>
                    );
                  }
                  if (folder?.status === "creating" || folder?.status === "pending") {
                    return <p style={{ fontSize: 12.5, color: "#999", marginTop: 10 }}>Preparing your files for download…</p>;
                  }
                  if (folder?.status === "failed") {
                    return <p style={{ fontSize: 12.5, color: "#c43f50", marginTop: 10 }}>We hit a snag preparing the full download — use the per-clip links below, or contact support.</p>;
                  }
                  return null;
                })()}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {bundle.videos.map((video) => (
                    <div key={video.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #eee" }}>
                      <span style={{ fontSize: 13.5 }}>{video.name}</span>
                      {video.original_drive_url ? (
                        <a href={video.original_drive_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#6b5bff" }}>
                          Download
                        </a>
                      ) : (
                        <span style={{ fontSize: 12.5, color: "#999" }}>Preparing file…</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}