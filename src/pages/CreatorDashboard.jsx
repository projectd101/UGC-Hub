import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { createWatermarkedPreview } from "../lib/watermark";
import styles from "./Dashboard.module.css";

const EMOTIONS = ["Happy", "Laughing", "Surprised", "Confused", "Excited", "Sad", "Angry", "Disgusted"];
const NICHES = ["Reaction", "Meme", "UGC", "Gaming", "Lifestyle", "Comedy", "Ads", "Product"];

function MenuIcon() { return <span className={styles.menuGlyph} aria-hidden="true"><i /><i /><i /></span>; }
function BellIcon() { return <span className={styles.bellGlyph} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span>; }
function WalletIcon() { return <span className={styles.walletGlyph} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 7h14.5A2.5 2.5 0 0 1 21 9.5v5H16a2.5 2.5 0 0 1 0-5h5"/><circle cx="16" cy="12" r=".7" fill="currentColor" stroke="none"/></svg></span>; }
function UploadIcon() { return <span className={styles.featureIcon} aria-hidden="true">↑</span>; }
function LibraryIcon() { return <span className={styles.featureIcon} aria-hidden="true">▦</span>; }
function BundleIcon() { return <span className={styles.featureIcon} aria-hidden="true">◈</span>; }

const VIDEO_BUCKET = "creator-videos";

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
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

  const [videos, setVideos] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [libraryVideoIds, setLibraryVideoIds] = useState({}); // { [libraryId]: string[] }
  const [bundles, setBundles] = useState([]);
  const [pricePerClipCents, setPricePerClipCents] = useState(40);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [selectedEmotion, setSelectedEmotion] = useState("Happy");
  const [selectedNiche, setSelectedNiche] = useState("Reaction");
  const [libraryName, setLibraryName] = useState("");
  const [libraryDescription, setLibraryDescription] = useState("");
  const [bundleName, setBundleName] = useState("");
  const [bundleDescription, setBundleDescription] = useState("");
  const [bundleLibrary, setBundleLibrary] = useState("");
  const fileInput = useRef(null);

  // Load creator row + all their content on mount.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: creatorRow } = await supabase
        .from("creators")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setCreator(creatorRow);

      if (!creatorRow) {
        setLoading(false);
        return;
      }

      const [videosRes, librariesRes, bundlesRes, settingsRes] = await Promise.all([
        supabase.from("videos").select("*").eq("creator_id", creatorRow.id).order("created_at", { ascending: false }),
        supabase.from("libraries").select("*").eq("creator_id", creatorRow.id).order("created_at", { ascending: false }),
        supabase.from("bundles").select("*").eq("creator_id", creatorRow.id).order("created_at", { ascending: false }),
        supabase.from("platform_settings").select("price_per_clip_cents").eq("id", true).maybeSingle(),
      ]);

      if (cancelled) return;

      const loadedVideos = videosRes.data || [];
      setVideos(await attachPreviewUrls(loadedVideos));
      setLibraries(librariesRes.data || []);
      setBundles(bundlesRes.data || []);
      if (settingsRes.data) setPricePerClipCents(settingsRes.data.price_per_clip_cents);

      const libraryIds = (librariesRes.data || []).map((l) => l.id);
      if (libraryIds.length) {
        const { data: lv } = await supabase
          .from("library_videos")
          .select("library_id, video_id")
          .in("library_id", libraryIds);
        if (!cancelled) {
          const grouped = {};
          for (const row of lv || []) {
            (grouped[row.library_id] ||= []).push(row.video_id);
          }
          setLibraryVideoIds(grouped);
        }
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user.id]);

  // Signed URLs for a creator's own (private) files, so they can preview them in-studio.
  async function attachPreviewUrls(videoRows) {
    const withUrls = await Promise.all(
      videoRows.map(async (v) => {
        const { data } = await supabase.storage
          .from(VIDEO_BUCKET)
          .createSignedUrl(v.storage_path, 3600);
        return { ...v, previewUrl: data?.signedUrl || null };
      })
    );
    return withUrls;
  }

  const stats = useMemo(() => ({
    videos: videos.length,
    libraries: libraries.length,
    bundles: bundles.length,
    published: videos.filter((video) => video.status === "published").length,
  }), [videos, libraries, bundles]);

  function closePanels() { setDrawerOpen(false); setNotificationsOpen(false); setWalletOpen(false); setActivePanel(null); }
  function openMenu(panel = null) { setNotificationsOpen(false); setWalletOpen(false); setDrawerOpen(true); setActivePanel(panel); }
  function handleDeleteAccount() {
    if (window.confirm("Delete your UGC Hub account? This action cannot be undone.")) window.alert("Account deletion is not connected yet. No account was deleted.");
  }
  function goTo(nextTab) { closePanels(); setTab(nextTab); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith("video/"));
    if (!files.length || !creator) return;

    setUploading(true);
    setUploadError(null);

    const uploaded = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const originalPath = `${creator.id}/${crypto.randomUUID()}.${ext}`;
      const watermarkedPath = `${creator.id}/${crypto.randomUUID()}-preview.mp4`;

      // 1. Upload the ORIGINAL, untouched, to the private bucket — this is
      // what eventually goes to Drive and is what a paying founder downloads.
      setUploadStatus(`Uploading ${file.name}…`);
      const { error: uploadErr } = await supabase.storage.from(VIDEO_BUCKET).upload(originalPath, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadErr) {
        setUploadError(`Failed to upload ${file.name}: ${uploadErr.message}`);
        continue;
      }

      // 2. Generate a watermarked, compressed preview IN THE BROWSER via
      // ffmpeg.wasm. This never touches the original file or its upload —
      // if watermarking fails, the original is still safely stored, we just
      // skip having a preview for this clip (surfaced via processing_status).
      let watermarkedBlob = null;
      try {
        watermarkedBlob = await createWatermarkedPreview(file, (status) => setUploadStatus(`${file.name}: ${status}`));
      } catch (wmErr) {
        console.error("Watermarking failed:", wmErr);
        setUploadError(`Uploaded ${file.name}, but watermarking failed — it won't be visible to founders until this is retried.`);
      }

      let watermarkedStoragePath = null;
      if (watermarkedBlob) {
        setUploadStatus(`Uploading watermarked preview for ${file.name}…`);
        const { error: wmUploadErr } = await supabase.storage.from(VIDEO_BUCKET).upload(watermarkedPath, watermarkedBlob, {
          contentType: "video/mp4",
          upsert: false,
        });
        if (wmUploadErr) {
          console.error("Watermarked preview upload failed:", wmUploadErr);
          setUploadError(`Uploaded ${file.name}, but its watermarked preview failed to save.`);
        } else {
          watermarkedStoragePath = watermarkedPath;
        }
      }

      const { data: row, error: insertErr } = await supabase
        .from("videos")
        .insert({
          creator_id: creator.id,
          storage_path: originalPath,
          watermarked_storage_path: watermarkedStoragePath,
          processing_status: watermarkedStoragePath ? "ready" : "pending",
          filename: file.name,
          name: file.name.replace(/\.[^.]+$/, ""),
          size_bytes: file.size,
          emotion: selectedEmotion,
          niche: selectedNiche,
        })
        .select()
        .single();

      if (insertErr) {
        setUploadError(`Uploaded ${file.name} but failed to save it: ${insertErr.message}`);
        await supabase.storage.from(VIDEO_BUCKET).remove([originalPath]);
        if (watermarkedStoragePath) await supabase.storage.from(VIDEO_BUCKET).remove([watermarkedStoragePath]);
        continue;
      }

      // Preview shown in the creator's own studio uses the WATERMARKED
      // version when available — this is also roughly what a founder will
      // see, so it doubles as an at-a-glance check that watermarking worked.
      const previewSourcePath = watermarkedStoragePath || originalPath;
      const { data: signed } = await supabase.storage.from(VIDEO_BUCKET).createSignedUrl(previewSourcePath, 3600);
      uploaded.push({ ...row, previewUrl: signed?.signedUrl || null });

      // Kick off the Google Drive upload of the ORIGINAL in the background.
      // Not awaited — this can take a while for larger files, and the
      // creator's upload flow shouldn't block on it. If it fails, the video
      // is still saved and usable; original_drive_url just stays empty
      // until a retry.
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: row.id }),
      }).catch((err) => console.error("Drive upload trigger failed:", err));
    }

    if (uploaded.length) {
      setVideos((current) => [...uploaded, ...current]);
      setTab("videos");
    }
    setUploadStatus(null);
    setUploading(false);
  }

  async function removeVideo(id) {
    const video = videos.find((v) => v.id === id);
    if (!video) return;
    const confirmed = window.confirm(`Remove "${video.name}"? This can't be undone.`);
    if (!confirmed) return;

    const { error } = await supabase.from("videos").delete().eq("id", id);
    if (error) {
      window.alert(`Couldn't remove video: ${error.message}`);
      return;
    }
    const pathsToRemove = [video.storage_path];
    if (video.watermarked_storage_path) pathsToRemove.push(video.watermarked_storage_path);
    await supabase.storage.from(VIDEO_BUCKET).remove(pathsToRemove);
    setVideos((current) => current.filter((v) => v.id !== id));
    setLibraryVideoIds((current) => {
      const next = {};
      for (const [libId, ids] of Object.entries(current)) next[libId] = ids.filter((vid) => vid !== id);
      return next;
    });
  }

  async function createLibrary(event) {
    event.preventDefault();
    if (!libraryName.trim() || !creator) return;

    const { data: library, error } = await supabase
      .from("libraries")
      .insert({ creator_id: creator.id, name: libraryName.trim(), description: libraryDescription.trim() || null })
      .select()
      .single();

    if (error) {
      window.alert(`Couldn't create library: ${error.message}`);
      return;
    }

    // New library starts with all current videos, mirroring prior behavior.
    if (videos.length) {
      const rows = videos.map((v) => ({ library_id: library.id, video_id: v.id }));
      await supabase.from("library_videos").insert(rows);
      setLibraryVideoIds((current) => ({ ...current, [library.id]: videos.map((v) => v.id) }));
    } else {
      setLibraryVideoIds((current) => ({ ...current, [library.id]: [] }));
    }

    setLibraries((current) => [library, ...current]);
    setLibraryName("");
    setLibraryDescription("");
    setTab("libraries");
  }

  async function createBundle(event) {
    event.preventDefault();
    if (!bundleName.trim() || !creator) return;

    const library = libraries.find((item) => item.id === bundleLibrary) || null;

    // video_count / price_cents are recomputed server-side by a trigger;
    // the values sent here are placeholders that the DB will overwrite.
    const { data: bundle, error } = await supabase
      .from("bundles")
      .insert({
        creator_id: creator.id,
        library_id: library?.id || null,
        name: bundleName.trim(),
        description: bundleDescription.trim() || null,
      })
      .select()
      .single();

    if (error) {
      window.alert(`Couldn't create bundle: ${error.message}`);
      return;
    }

    setBundles((current) => [bundle, ...current]);
    setBundleName("");
    setBundleDescription("");
    setBundleLibrary("");
    setTab("bundles");
  }

  async function toggleVideoPublished(video) {
    const nextStatus = video.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("videos").update({ status: nextStatus }).eq("id", video.id);
    if (error) return window.alert(`Couldn't update video: ${error.message}`);
    setVideos((current) => current.map((v) => (v.id === video.id ? { ...v, status: nextStatus } : v)));
  }

  async function toggleLibraryPublished(library) {
    const nextStatus = library.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("libraries").update({ status: nextStatus }).eq("id", library.id);
    if (error) return window.alert(`Couldn't update library: ${error.message}`);
    setLibraries((current) => current.map((l) => (l.id === library.id ? { ...l, status: nextStatus } : l)));
  }

  async function toggleBundlePublished(bundle) {
    const nextStatus = bundle.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("bundles").update({ status: nextStatus }).eq("id", bundle.id);
    if (error) return window.alert(`Couldn't update bundle: ${error.message}`);
    setBundles((current) => current.map((b) => (b.id === bundle.id ? { ...b, status: nextStatus } : b)));
  }

  const previewBundlePrice = useMemo(() => {
    const library = libraries.find((item) => item.id === bundleLibrary);
    const count = library ? (libraryVideoIds[library.id]?.length || 0) : videos.length;
    return { count, priceCents: count * pricePerClipCents };
  }, [bundleLibrary, libraries, libraryVideoIds, videos.length, pricePerClipCents]);

  if (loading) {
    return <div className={styles.wrap}><main className={styles.main}><p className={styles.subtitle}>Loading your studio…</p></main></div>;
  }

  if (!creator) {
    return <div className={styles.wrap}><main className={styles.main}><p className={styles.subtitle}>We couldn't find your creator profile. Try signing out and back in.</p></main></div>;
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
          <div className={styles.featureGrid}><button className={styles.featureCard} onClick={() => goTo("videos")}><UploadIcon /><span><strong>Upload videos</strong><small>Add reaction clips and tag each one by emotion and niche.</small></span><b>→</b></button><button className={styles.featureCard} onClick={() => goTo("libraries")}><LibraryIcon /><span><strong>Build a library</strong><small>Group videos into a creator library founders can browse.</small></span><b>→</b></button><button className={styles.featureCard} onClick={() => goTo("bundles")}><BundleIcon /><span><strong>Make a bundle</strong><small>Package a library into a paid clip collection, priced at {formatPrice(pricePerClipCents)}/clip.</small></span><b>→</b></button></div>
          <div className={styles.studioCallout}><div><span className={styles.panelEyebrow}>Creator workflow</span><h2>Build once. Sell repeatedly.</h2><p>Keep individual clips organized, assemble them into libraries, then turn those libraries into bundles for founders.</p></div><button className={styles.walletAction} onClick={() => goTo("videos")}>Start uploading</button></div>
        </section>}

        {tab === "videos" && <section className={styles.studioSection}>
          <div className={styles.sectionHeading}><div><h2>Videos</h2><p>Your individual reaction clips. Add metadata now so they can be organized into libraries and bundles later.</p></div><button className={styles.primaryAction} onClick={() => fileInput.current?.click()} disabled={uploading}><UploadIcon /> {uploading ? "Uploading…" : "Upload videos"}</button></div>
          <div className={styles.uploadControls}><label>Emotion<select value={selectedEmotion} onChange={(e) => setSelectedEmotion(e.target.value)}>{EMOTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Niche<select value={selectedNiche} onChange={(e) => setSelectedNiche(e.target.value)}>{NICHES.map((item) => <option key={item}>{item}</option>)}</select></label><input ref={fileInput} hidden type="file" accept="video/*" multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} /></div>
          {uploadError && <p style={{ color: "#c43f50", fontSize: 12.5 }}>{uploadError}</p>}
          <button className={styles.dropzone} onClick={() => fileInput.current?.click()} disabled={uploading}><span className={styles.dropzoneIcon}>↑</span><strong>{uploadStatus || "Drop videos here or click to upload"}</strong><small>MP4, MOV, WebM · 9:16 reaction clips recommended · watermarking runs in your browser and may take a few seconds per clip</small></button>
          {!videos.length ? <div className={styles.emptyCreatorState}><strong>No videos yet</strong><span>Upload your first reaction clips to start building your library.</span></div> : <div className={styles.videoGrid}>{videos.map((video) => <article key={video.id} className={styles.videoCard}>{video.previewUrl ? <video src={video.previewUrl} muted controls playsInline /> : <div className={styles.videoPlaceholder}>Video</div>}<div className={styles.videoCardBody}><div className={styles.videoCardTop}><div><h3>{video.name}</h3><span>{video.filename}</span></div><button className={styles.moreButton} onClick={() => removeVideo(video.id)} aria-label={`Remove ${video.name}`}>×</button></div><div className={styles.pillRow}><span className={styles.pill}>{video.emotion}</span><span className={`${styles.pill} ${styles.pillViolet}`}>{video.niche}</span>{video.processing_status === "pending" && <span className={styles.pill} style={{ background: "#fff3cd", color: "#8a6d00" }}>Watermark pending</span>}{video.processing_status === "failed" && <span className={styles.pill} style={{ background: "#fde2e2", color: "#c43f50" }}>Watermark failed</span>}</div><div className={styles.videoMeta}><span>{video.status === "published" ? "Published" : "Draft"}</span><button onClick={() => toggleVideoPublished(video)}>{video.status === "published" ? "Unpublish" : "Publish"}</button></div></div></article>)}</div>}
        </section>}

        {tab === "libraries" && <section className={styles.studioSection}>
          <div className={styles.sectionHeading}><div><h2>Libraries</h2><p>Create collections of videos around a face, emotion set, niche, campaign, or use case.</p></div></div>
          <form className={styles.creatorForm} onSubmit={createLibrary}><div className={styles.formGrid}><label>Library name<input value={libraryName} onChange={(e) => setLibraryName(e.target.value)} placeholder="e.g. Alex — Core Reactions" /></label><label>Description<input value={libraryDescription} onChange={(e) => setLibraryDescription(e.target.value)} placeholder="Short description for founders" /></label></div><div className={styles.formFooter}><span>{videos.length} videos currently available to add</span><button className={styles.primaryAction} type="submit">Create library</button></div></form>
          {!libraries.length ? <div className={styles.emptyCreatorState}><strong>No libraries yet</strong><span>Create your first library and it will become the structure you use to package your content.</span></div> : <div className={styles.libraryGrid}>{libraries.map((library) => <article className={styles.libraryCard} key={library.id}><div className={styles.libraryCardTop}><span className={styles.libraryMark}>▦</span><span className={library.status === "published" ? styles.publishedBadge : styles.draftBadge}>{library.status === "published" ? "Published" : "Draft"}</span></div><h3>{library.name}</h3><p>{library.description || "No description yet."}</p><div className={styles.libraryMeta}><span>{libraryVideoIds[library.id]?.length || 0} videos</span><button onClick={() => toggleLibraryPublished(library)}>{library.status === "published" ? "Unpublish" : "Publish"}</button></div></article>)}</div>}
        </section>}

        {tab === "bundles" && <section className={styles.studioSection}>
          <div className={styles.sectionHeading}><div><h2>Bundles</h2><p>Turn a library into a product founders can buy, priced automatically at {formatPrice(pricePerClipCents)} per clip.</p></div></div>
          <form className={styles.creatorForm} onSubmit={createBundle}><div className={styles.formGrid}><label>Bundle name<input value={bundleName} onChange={(e) => setBundleName(e.target.value)} placeholder="e.g. 100 Reaction Clips" /></label><label>Source library<select value={bundleLibrary} onChange={(e) => setBundleLibrary(e.target.value)}><option value="">All creator videos</option>{libraries.map((library) => <option key={library.id} value={library.id}>{library.name} · {libraryVideoIds[library.id]?.length || 0} videos</option>)}</select></label></div><label>Description<input value={bundleDescription} onChange={(e) => setBundleDescription(e.target.value)} placeholder="What founders get in this bundle" /></label><div className={styles.formFooter}><span>{previewBundlePrice.count} videos included · {formatPrice(previewBundlePrice.priceCents)} at ${(pricePerClipCents / 100).toFixed(2)}/clip</span><button className={styles.primaryAction} type="submit">Create bundle</button></div></form>
          {!bundles.length ? <div className={styles.emptyCreatorState}><strong>No bundles yet</strong><span>Create a bundle after you have videos or libraries ready.</span></div> : <div className={styles.bundleGrid}>{bundles.map((bundle) => <article className={styles.bundleCard} key={bundle.id}><div className={styles.bundleTop}><span className={bundle.status === "published" ? styles.publishedBadge : styles.draftBadge}>{bundle.status === "published" ? "Published" : "Draft"}</span><strong>{formatPrice(bundle.price_cents)}</strong></div><h3>{bundle.name}</h3><p>{bundle.description || "No description yet."}</p><div className={styles.bundleMeta}><span>{bundle.video_count} videos · {libraries.find((l) => l.id === bundle.library_id)?.name || "All creator videos"}</span><button onClick={() => toggleBundlePublished(bundle)}>{bundle.status === "published" ? "Unpublish" : "Publish"}</button></div></article>)}</div>}
        </section>}
      </main>
    </div>
  );
}
