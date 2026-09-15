import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/AuthContext";
import styles from "./Dashboard.module.css";

const EMOTIONS = ["Happy", "Laughing", "Surprised", "Confused", "Excited", "Sad", "Angry", "Disgusted"];
const NICHES = ["Reaction", "Meme", "UGC", "Gaming", "Lifestyle", "Comedy", "Ads", "Product"];

function MenuIcon() { return <span className={styles.menuGlyph} aria-hidden="true"><i /><i /><i /></span>; }
function BellIcon() { return <span className={styles.bellGlyph} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span>; }
function WalletIcon() { return <span className={styles.walletGlyph} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 7h14.5A2.5 2.5 0 0 1 21 9.5v5H16a2.5 2.5 0 0 1 0-5h5"/><circle cx="16" cy="12" r=".7" fill="currentColor" stroke="none"/></svg></span>; }
function UploadIcon() { return <span className={styles.featureIcon} aria-hidden="true">↑</span>; }
function LibraryIcon() { return <span className={styles.featureIcon} aria-hidden="true">▦</span>; }
function BundleIcon() { return <span className={styles.featureIcon} aria-hidden="true">◈</span>; }

function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

export default function CreatorDashboard() {
  const { user, signOut } = useAuth();
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [videos, setVideos] = useState(() => readLocal("ugc-hub-creator-videos", []));
  const [libraries, setLibraries] = useState(() => readLocal("ugc-hub-creator-libraries", []));
  const [bundles, setBundles] = useState(() => readLocal("ugc-hub-creator-bundles", []));
  const [uploading, setUploading] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState("Happy");
  const [selectedNiche, setSelectedNiche] = useState("Reaction");
  const [libraryName, setLibraryName] = useState("");
  const [libraryDescription, setLibraryDescription] = useState("");
  const [bundleName, setBundleName] = useState("");
  const [bundleDescription, setBundleDescription] = useState("");
  const [bundlePrice, setBundlePrice] = useState("40");
  const [bundleLibrary, setBundleLibrary] = useState("");
  const fileInput = useRef(null);

  useEffect(() => {
    async function load() {
      const { data: creatorRow } = await supabase.from("creators").select("*").eq("user_id", user.id).maybeSingle();
      setCreator(creatorRow);
      setLoading(false);
    }
    load();
  }, [user.id]);

  useEffect(() => localStorage.setItem("ugc-hub-creator-videos", JSON.stringify(videos.map(({ previewUrl, ...video }) => video))), [videos]);
  useEffect(() => localStorage.setItem("ugc-hub-creator-libraries", JSON.stringify(libraries)), [libraries]);
  useEffect(() => localStorage.setItem("ugc-hub-creator-bundles", JSON.stringify(bundles)), [bundles]);

  const stats = useMemo(() => ({
    videos: videos.length,
    libraries: libraries.length,
    bundles: bundles.length,
    published: videos.filter((video) => video.status === "Published").length,
  }), [videos, libraries, bundles]);

  function closePanels() { setDrawerOpen(false); setNotificationsOpen(false); setWalletOpen(false); setActivePanel(null); }
  function openMenu(panel = null) { setNotificationsOpen(false); setWalletOpen(false); setDrawerOpen(true); setActivePanel(panel); }
  function handleDeleteAccount() {
    if (window.confirm("Delete your UGC Hub account? This action cannot be undone.")) window.alert("Account deletion is not connected yet. No account was deleted.");
  }
  function goTo(nextTab) { closePanels(); setTab(nextTab); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith("video/"));
    if (!files.length) return;
    setUploading(true);
    const next = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      filename: file.name,
      size: file.size,
      emotion: selectedEmotion,
      niche: selectedNiche,
      status: "Draft",
      previewUrl: URL.createObjectURL(file),
      createdAt: new Date().toISOString(),
    }));
    setVideos((current) => [...next, ...current]);
    setUploading(false);
    setTab("videos");
  }

  function removeVideo(id) {
    setVideos((current) => current.filter((video) => video.id !== id));
    setLibraries((current) => current.map((library) => ({ ...library, videoIds: library.videoIds.filter((videoId) => videoId !== id) })));
  }

  function createLibrary(event) {
    event.preventDefault();
    if (!libraryName.trim()) return;
    const library = { id: `lib-${Date.now()}`, name: libraryName.trim(), description: libraryDescription.trim(), videoIds: videos.map((video) => video.id), status: "Draft", createdAt: new Date().toISOString() };
    setLibraries((current) => [library, ...current]);
    setLibraryName(""); setLibraryDescription(""); setTab("libraries");
  }

  function createBundle(event) {
    event.preventDefault();
    if (!bundleName.trim()) return;
    const library = libraries.find((item) => item.id === bundleLibrary);
    const bundle = { id: `bundle-${Date.now()}`, name: bundleName.trim(), description: bundleDescription.trim(), price: Number(bundlePrice) || 0, libraryId: library?.id || null, libraryName: library?.name || "All creator videos", videoCount: library ? library.videoIds.length : videos.length, status: "Draft", createdAt: new Date().toISOString() };
    setBundles((current) => [bundle, ...current]);
    setBundleName(""); setBundleDescription(""); setBundlePrice("40"); setBundleLibrary(""); setTab("bundles");
  }

  function togglePublished(setter, id) {
    setter((items) => items.map((item) => item.id === id ? { ...item, status: item.status === "Published" ? "Draft" : "Published" } : item));
  }

  return (
    <div className={styles.wrap}>
      {(drawerOpen || notificationsOpen || walletOpen) && <button className={styles.backdrop} aria-label="Close" onClick={closePanels} />}
      <header className={styles.header}>
        <a href="/" className={`${styles.logo} ugcBrandMark`} aria-label="UGC Hub home"><span className="ugcBrandMark__ugc">UGC</span><span className="ugcBrandMark__hub">Hub</span></a>
        <div className={styles.headerActions}>
          <button className={styles.iconButton} aria-label="Wallet" aria-expanded={walletOpen} onClick={() => { closePanels(); setWalletOpen(true); }}><WalletIcon /></button>
          <button className={styles.iconButton} aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { closePanels(); setNotificationsOpen(true); }}><BellIcon /><span className={styles.notificationDot} /></button>
          <button className={styles.iconButton} aria-label="Account menu" aria-expanded={drawerOpen} onClick={() => (drawerOpen ? closePanels() : openMenu())}><MenuIcon /></button>
          <button className={styles.signOut} onClick={signOut}>Sign out</button>
        </div>
      </header>

      {walletOpen && <aside className={styles.notificationPanel} aria-label="Wallet"><div className={styles.panelHeader}><div><span className={styles.panelEyebrow}>Creator earnings</span><h2>Wallet</h2></div><button className={styles.closeButton} onClick={closePanels}>×</button></div><div className={styles.walletBalance}><span>Available balance</span><strong>$0.00</strong><small>Earnings and payout status will appear here once your reaction libraries generate revenue.</small></div><button className={styles.walletAction} onClick={() => { setWalletOpen(false); openMenu("payouts"); }}>Set up payouts</button></aside>}
      {notificationsOpen && <aside className={styles.notificationPanel} aria-label="Notifications"><div className={styles.panelHeader}><div><span className={styles.panelEyebrow}>Updates</span><h2>Notifications</h2></div><button className={styles.closeButton} onClick={closePanels}>×</button></div><div className={styles.emptyState}><BellIcon /><strong>You're all caught up</strong><span>New founder activity, library updates and payout notifications will appear here.</span></div></aside>}

      <aside className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ""}`} aria-hidden={!drawerOpen}>
        <div className={styles.drawerHeader}><div><span className={styles.panelEyebrow}>Creator account</span><h2>Menu</h2></div><button className={styles.closeButton} onClick={closePanels}>×</button></div>
        <div className={styles.accountCard}><div className={styles.accountAvatar}>{(creator?.display_name || user?.email || "C").charAt(0).toUpperCase()}</div><div><strong>{creator?.display_name || "Creator"}</strong><span>{user?.email || "Creator account"}</span></div></div>
        <nav className={styles.drawerNav}>
          <button className={styles.drawerItem} onClick={() => setActivePanel("profile")}><span>Account information</span><b>›</b></button>
          <button className={styles.drawerItem} onClick={() => setActivePanel("history")}><span>History</span><b>›</b></button>
          <button className={styles.drawerItem} onClick={() => setActivePanel("payouts")}><span>Payouts</span><b>›</b></button>
        </nav>
        {activePanel && <div className={styles.drawerDetail}><span className={styles.panelEyebrow}>{activePanel === "profile" ? "Account" : activePanel === "history" ? "Activity" : "Payments"}</span><h3>{activePanel === "profile" ? "Account information" : activePanel === "history" ? "History" : "Payouts"}</h3><p>{activePanel === "profile" ? "Your creator account details and public profile settings will live here." : activePanel === "history" ? "Your library activity, uploads and account history will appear here." : "Set up how UGC Hub should send your earnings. Your payout method will be stored securely when payments are connected."}</p>{activePanel === "payouts" && <button className={styles.walletAction}>Set up payout method</button>}</div>}
        <div className={styles.drawerFooter}><button className={`${styles.drawerItem} ${styles.deleteItem}`} onClick={handleDeleteAccount}><span>Delete account</span><b>›</b></button></div>
      </aside>

      <main className={styles.main}>
        <div className={styles.profileSummary}><div><span className={styles.panelEyebrow}>Creator studio</span><h1 className={styles.title}>{creator?.display_name || "Creator"}</h1><p className={styles.subtitle}>Upload reactions, organize libraries, build bundles, and keep your storefront ready for founders.</p></div><span className={styles.activeBadge}>Active</span></div>
        <nav className={styles.creatorTabs} aria-label="Creator studio"><button className={tab === "overview" ? styles.creatorTabActive : styles.creatorTab} onClick={() => setTab("overview")}>Overview</button><button className={tab === "videos" ? styles.creatorTabActive : styles.creatorTab} onClick={() => setTab("videos")}>Videos <b>{stats.videos}</b></button><button className={tab === "libraries" ? styles.creatorTabActive : styles.creatorTab} onClick={() => setTab("libraries")}>Libraries <b>{stats.libraries}</b></button><button className={tab === "bundles" ? styles.creatorTabActive : styles.creatorTab} onClick={() => setTab("bundles")}>Bundles <b>{stats.bundles}</b></button></nav>

        {tab === "overview" && <section className={styles.studioSection}>
          <div className={styles.statsGrid}><div className={styles.statCard}><span>Videos</span><strong>{stats.videos}</strong><small>{stats.published} published</small></div><div className={styles.statCard}><span>Libraries</span><strong>{stats.libraries}</strong><small>Curated collections</small></div><div className={styles.statCard}><span>Bundles</span><strong>{stats.bundles}</strong><small>Ready to sell</small></div><div className={styles.statCard}><span>Wallet</span><strong>$0</strong><small>Available balance</small></div></div>
          <div className={styles.featureGrid}><button className={styles.featureCard} onClick={() => goTo("videos")}><UploadIcon /><span><strong>Upload videos</strong><small>Add reaction clips and tag each one by emotion and niche.</small></span><b>→</b></button><button className={styles.featureCard} onClick={() => goTo("libraries")}><LibraryIcon /><span><strong>Build a library</strong><small>Group videos into a creator library founders can browse.</small></span><b>→</b></button><button className={styles.featureCard} onClick={() => goTo("bundles")}><BundleIcon /><span><strong>Make a bundle</strong><small>Package a library into a paid clip collection with a clear price.</small></span><b>→</b></button></div>
          <div className={styles.studioCallout}><div><span className={styles.panelEyebrow}>Creator workflow</span><h2>Build once. Sell repeatedly.</h2><p>Keep individual clips organized, assemble them into libraries, then turn those libraries into bundles for founders.</p></div><button className={styles.walletAction} onClick={() => goTo("videos")}>Start uploading</button></div>
        </section>}

        {tab === "videos" && <section className={styles.studioSection}>
          <div className={styles.sectionHeading}><div><h2>Videos</h2><p>Your individual reaction clips. Add metadata now so they can be organized into libraries and bundles later.</p></div><button className={styles.primaryAction} onClick={() => fileInput.current?.click()}><UploadIcon /> Upload videos</button></div>
          <div className={styles.uploadControls}><label>Emotion<select value={selectedEmotion} onChange={(e) => setSelectedEmotion(e.target.value)}>{EMOTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Niche<select value={selectedNiche} onChange={(e) => setSelectedNiche(e.target.value)}>{NICHES.map((item) => <option key={item}>{item}</option>)}</select></label><input ref={fileInput} hidden type="file" accept="video/*" multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} /></div>
          <button className={styles.dropzone} onClick={() => fileInput.current?.click()}><span className={styles.dropzoneIcon}>↑</span><strong>{uploading ? "Adding videos…" : "Drop videos here or click to upload"}</strong><small>MP4, MOV, WebM · 9:16 reaction clips recommended</small></button>
          {!videos.length ? <div className={styles.emptyCreatorState}><strong>No videos yet</strong><span>Upload your first reaction clips to start building your library.</span></div> : <div className={styles.videoGrid}>{videos.map((video) => <article key={video.id} className={styles.videoCard}>{video.previewUrl ? <video src={video.previewUrl} muted controls playsInline /> : <div className={styles.videoPlaceholder}>Video</div>}<div className={styles.videoCardBody}><div className={styles.videoCardTop}><div><h3>{video.name}</h3><span>{video.filename}</span></div><button className={styles.moreButton} onClick={() => removeVideo(video.id)} aria-label={`Remove ${video.name}`}>×</button></div><div className={styles.pillRow}><span className={styles.pill}>{video.emotion}</span><span className={`${styles.pill} ${styles.pillViolet}`}>{video.niche}</span></div><div className={styles.videoMeta}><span>{video.status}</span><button onClick={() => togglePublished(setVideos, video.id)}>{video.status === "Published" ? "Unpublish" : "Publish"}</button></div></div></article>)}</div>}
        </section>}

        {tab === "libraries" && <section className={styles.studioSection}>
          <div className={styles.sectionHeading}><div><h2>Libraries</h2><p>Create collections of videos around a face, emotion set, niche, campaign, or use case.</p></div></div>
          <form className={styles.creatorForm} onSubmit={createLibrary}><div className={styles.formGrid}><label>Library name<input value={libraryName} onChange={(e) => setLibraryName(e.target.value)} placeholder="e.g. Alex — Core Reactions" /></label><label>Description<input value={libraryDescription} onChange={(e) => setLibraryDescription(e.target.value)} placeholder="Short description for founders" /></label></div><div className={styles.formFooter}><span>{videos.length} videos currently available to add</span><button className={styles.primaryAction} type="submit">Create library</button></div></form>
          {!libraries.length ? <div className={styles.emptyCreatorState}><strong>No libraries yet</strong><span>Create your first library and it will become the structure you use to package your content.</span></div> : <div className={styles.libraryGrid}>{libraries.map((library) => <article className={styles.libraryCard} key={library.id}><div className={styles.libraryCardTop}><span className={styles.libraryMark}>▦</span><span className={library.status === "Published" ? styles.publishedBadge : styles.draftBadge}>{library.status}</span></div><h3>{library.name}</h3><p>{library.description || "No description yet."}</p><div className={styles.libraryMeta}><span>{library.videoIds.length} videos</span><button onClick={() => togglePublished(setLibraries, library.id)}>{library.status === "Published" ? "Unpublish" : "Publish"}</button></div></article>)}</div>}
        </section>}

        {tab === "bundles" && <section className={styles.studioSection}>
          <div className={styles.sectionHeading}><div><h2>Bundles</h2><p>Turn a library into a product founders can buy. Set the package name, contents and price.</p></div></div>
          <form className={styles.creatorForm} onSubmit={createBundle}><div className={styles.formGrid}><label>Bundle name<input value={bundleName} onChange={(e) => setBundleName(e.target.value)} placeholder="e.g. 100 Reaction Clips" /></label><label>Price (USD)<input type="number" min="0" step="1" value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} /></label></div><label>Description<input value={bundleDescription} onChange={(e) => setBundleDescription(e.target.value)} placeholder="What founders get in this bundle" /></label><label>Source library<select value={bundleLibrary} onChange={(e) => setBundleLibrary(e.target.value)}><option value="">All creator videos</option>{libraries.map((library) => <option key={library.id} value={library.id}>{library.name} · {library.videoIds.length} videos</option>)}</select></label><div className={styles.formFooter}><span>{bundleLibrary ? `${libraries.find((item) => item.id === bundleLibrary)?.videoIds.length || 0} videos included` : `${videos.length} videos included`}</span><button className={styles.primaryAction} type="submit">Create bundle</button></div></form>
          {!bundles.length ? <div className={styles.emptyCreatorState}><strong>No bundles yet</strong><span>Create a bundle after you have videos or libraries ready.</span></div> : <div className={styles.bundleGrid}>{bundles.map((bundle) => <article className={styles.bundleCard} key={bundle.id}><div className={styles.bundleTop}><span className={bundle.status === "Published" ? styles.publishedBadge : styles.draftBadge}>{bundle.status}</span><strong>${bundle.price}</strong></div><h3>{bundle.name}</h3><p>{bundle.description || "No description yet."}</p><div className={styles.bundleMeta}><span>{bundle.videoCount} videos · {bundle.libraryName}</span><button onClick={() => togglePublished(setBundles, bundle.id)}>{bundle.status === "Published" ? "Unpublish" : "Publish"}</button></div></article>)}</div>}
        </section>}
      </main>
    </div>
  );
}
