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
  const [purchasedBundleIds, setPurchasedBundleIds] = useState(new Set());
  const [driveFolders, setDriveFolders] = useState({}); // { [bundleId]: { status, drive_folder_url } }
  const [buyingBundleId, setBuyingBundleId] = useState(null);
  const [buyError, setBuyError] = useState(null);
  const [openBundleId, setOpenBundleId] = useState(null); // bundle whose detail view is open
  const [previewClips, setPreviewClips] = useState({}); // { [bundleId]: [{ video_id, name, emotion, niche, url }] }

  function loadData() {
    return Promise.all([
      supabase.from("creators_public").select("*").order("created_at", { ascending: false }),
      supabase.from("bundles_public").select("*").order("created_at", { ascending: false }),
      supabase.from("founders").select("id").eq("user_id", user.id).maybeSingle(),
    ]).then(async ([creatorsRes, bundlesRes, founderRes]) => {
      setCreators(creatorsRes.data || []);
      setBundles(bundlesRes.data || []);

      // Watermarked previews of every clip in every published bundle. These
      // come from a view that exposes ONLY the watermarked file path, never
      // the clean original or any Drive field, so browsing stays free while
      // the real files stay locked until payment.
      const bundleIds = (bundlesRes.data || []).map((b) => b.id);
      if (bundleIds.length) {
        const { data: clips } = await supabase
          .from("bundle_preview_clips")
          .select("bundle_id, video_id, name, emotion, niche, watermarked_storage_path")
          .in("bundle_id", bundleIds);
        const withUrls = await Promise.all(
          (clips || []).map(async (clip) => {
            const { data: signed } = await supabase.storage
              .from("creator-videos")
              .createSignedUrl(clip.watermarked_storage_path, 3600);
            return { ...clip, url: signed?.signedUrl || null };
          })
        );
        const grouped = {};
        for (const clip of withUrls) (grouped[clip.bundle_id] ||= []).push(clip);
        setPreviewClips(grouped);
      }

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

            let videoQuery = supabase.from("videos").select("id, name, filename, processing_status");
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
  }

  useEffect(() => {
    loadData();
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

      // Access is granted only once the webhook confirms payment, never by
      // this redirect. The webhook also shares the private Drive folder with
      // this founder's Google account.
      window.location.href = body.checkout_url;
    } catch {
      setBuyError("Couldn't reach the payment service. Please try again.");
      setBuyingBundleId(null);
    }
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
        <h1 className={styles.title}>Discover reaction clips</h1>
        <p className={styles.subtitle}>Browse creators and preview every clip for free. Buy a bundle to unlock the full-quality originals.</p>

        <nav className={styles.creatorTabs} aria-label="Browse view">
          <button className={view === "creators" ? styles.creatorTabActive : styles.creatorTab} onClick={() => setView("creators")}>Creators <b>{creators.length}</b></button>
          <button className={view === "bundles" ? styles.creatorTabActive : styles.creatorTab} onClick={() => { setView("bundles"); setOpenBundleId(null); }}>Bundles <b>{bundles.length}</b></button>
          <button className={view === "purchases" ? styles.creatorTabActive : styles.creatorTab} onClick={() => setView("purchases")}>Purchased <b>{purchasedBundles.length}</b></button>
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
                <div className={styles.cardHead}>
                  <div className={styles.avatar}>
                    {c.avatar_url ? <img src={c.avatar_url} alt="" /> : (c.display_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3>{c.display_name}</h3>
                    <span className={styles.cardSub}>Reaction creator</span>
                  </div>
                </div>
                {c.bio && <p className={styles.bio}>{c.bio}</p>}
                {c.reactions?.length > 0 && (
                  <div>
                    <span className={styles.pillLabel}>Reactions</span>
                    <div className={styles.pillRow}>{c.reactions.map((r) => <span key={r} className={styles.pill}>{r}</span>)}</div>
                  </div>
                )}
                {c.niches?.length > 0 && (
                  <div>
                    <span className={styles.pillLabel}>Niches</span>
                    <div className={styles.pillRow}>{c.niches.map((n) => <span key={n} className={`${styles.pill} ${styles.pillViolet}`}>{n}</span>)}</div>
                  </div>
                )}
                <div className={styles.libraryMeta}>
                  <span>Reaction library</span>
                  <span className={styles.freeTag}>Available</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && view === "bundles" && bundles.length === 0 && (
          <div className={styles.emptyCreatorState}>
            <div className={styles.emptyCreatorIcon} />
            <strong>No bundles published yet</strong>
            <span>Bundles will appear here once creators publish a priced clip package.</span>
          </div>
        )}

        {!loading && view === "bundles" && bundles.length > 0 && !openBundleId && (
          <div className={styles.grid}>
            {bundles.map((b) => {
              const clips = previewClips[b.id] || [];
              const owned = purchasedBundleIds.has(b.id);
              const cover = clips.find((c) => c.url);
              const emotions = [...new Set(clips.map((c) => c.emotion).filter(Boolean))];
              const niches = [...new Set(clips.map((c) => c.niche).filter(Boolean))];
              return (
                <div key={b.id} className={`${styles.creatorCard} ${styles.bundleCardClickable}`} onClick={() => setOpenBundleId(b.id)} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") setOpenBundleId(b.id); }}>
                  <div className={styles.coverWrap}>
                    {cover ? (
                      // #t=0.5 makes the browser show a frame from half a second in as the poster.
                      <video className={styles.cover} src={`${cover.url}#t=0.5`} preload="metadata" muted playsInline />
                    ) : (
                      <div className={styles.coverEmpty}>🎬</div>
                    )}
                    <span className={styles.clipBadge}>{b.video_count} clips</span>
                  </div>
                  <div>
                    <h3>{b.name}</h3>
                    <span className={styles.cardSub}>by {b.creator_display_name}</span>
                  </div>
                  {b.description && <p className={styles.bio}>{b.description}</p>}
                  {(emotions.length > 0 || niches.length > 0) && (
                    <div className={styles.pillRow}>
                      {emotions.map((e) => <span key={e} className={styles.pill}>{e}</span>)}
                      {niches.map((n) => <span key={n} className={`${styles.pill} ${styles.pillViolet}`}>{n}</span>)}
                    </div>
                  )}
                  <div className={styles.libraryMeta}>
                    <strong>{formatPrice(b.price_cents)}</strong>
                    {owned ? <span className={styles.ownedTag}>✓ Purchased</span> : <span className={styles.viewLink}>View bundle →</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && view === "bundles" && openBundleId && (() => {
          const b = bundles.find((x) => x.id === openBundleId);
          if (!b) return null;
          const clips = previewClips[b.id] || [];
          const owned = purchasedBundleIds.has(b.id);
          return (
            <div className={styles.detail}>
              <button className={styles.backLink} onClick={() => setOpenBundleId(null)}>← All bundles</button>
              <div className={styles.detailHead}>
                <div>
                  <h2>{b.name}</h2>
                  <span className={styles.cardSub}>by {b.creator_display_name} · {b.video_count} clips</span>
                  {b.description && <p className={styles.bio} style={{ WebkitLineClamp: "unset", marginTop: 8 }}>{b.description}</p>}
                </div>
                <div className={styles.buyBox}>
                  <strong>{formatPrice(b.price_cents)}</strong>
                  {owned ? (
                    <span className={styles.ownedTag}>✓ Purchased</span>
                  ) : (
                    <button className={styles.primaryAction} onClick={() => handleBuyBundle(b.id)} disabled={buyingBundleId === b.id}>
                      {buyingBundleId === b.id ? "Starting checkout…" : "Buy bundle"}
                    </button>
                  )}
                </div>
              </div>
              {!owned && <p className={styles.hint}>These previews are watermarked. Buying unlocks the clean originals in a private Google Drive folder.</p>}

              {clips.length > 0 ? (
                <div className={styles.detailGrid}>
                  {clips.map((clip) => (
                    <div key={clip.video_id} className={styles.previewTile}>
                      {clip.url ? <video src={clip.url} controls preload="metadata" playsInline /> : <div className={styles.previewMissing}>Preview unavailable</div>}
                      <span>{clip.name}</span>
                      <div className={styles.pillRow} style={{ marginTop: 0 }}>
                        {clip.emotion && <span className={styles.pill}>{clip.emotion}</span>}
                        {clip.niche && <span className={`${styles.pill} ${styles.pillViolet}`}>{clip.niche}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.previewMissing}>This bundle has no watermarked previews yet.</div>
              )}
            </div>
          );
        })()}
        {buyError && <p className={styles.errorText}>{buyError}</p>}

        {!loading && view === "purchases" && purchasedBundles.length === 0 && (
          <div className={styles.emptyCreatorState}>
            <div className={styles.emptyCreatorIcon} />
            <strong>Nothing purchased yet</strong>
            <span>Bundles you buy will appear here with a private Google Drive download folder.</span>
          </div>
        )}

        {!loading && view === "purchases" && purchasedBundles.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {purchasedBundles.map((bundle) => (
              <div key={bundle.id} className={styles.creatorCard}>
                <h3>{bundle.name}</h3>
                {bundle.description && <p className={styles.bio}>{bundle.description}</p>}
                <div className={styles.libraryMeta}><span>{bundle.videos.length} clips</span><span className={styles.freeTag}>Purchased</span></div>
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
                    return <p style={{ fontSize: 12.5, color: "#c43f50", marginTop: 10 }}>We hit a snag preparing your download — please contact support and we'll sort it out.</p>;
                  }
                  return null;
                })()}
                <div className={styles.clipList}>
                  {bundle.videos.map((video) => (
                    <div key={video.id} className={styles.clipRow}>
                      <span>{video.name}</span>
                      <small>In Drive folder</small>
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