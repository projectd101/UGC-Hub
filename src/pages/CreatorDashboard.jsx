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
function BundleIcon() { return <span className={styles.featureIcon} aria-hidden="true">◈</span>; }

const VIDEO_BUCKET = "creator-videos";

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Creators never see the folder link itself here (RLS reveals it to the
// creator too, but there's nothing for them to do with it before a founder
// has bought anything) — just enough status to know upload/moving is done.
function DriveFolderStatus({ folder }) {
  if (!folder) return null;
  if (folder.status === "creating") return <span className={styles.lockedLabel} title="Creating a Drive folder for this bundle's clips">📁 Preparing files…</span>;
  if (folder.status === "ready") return <span className={styles.lockedLabel} title="All clips are in a dedicated Drive folder, ready for the buyer">📁 Files ready</span>;
  if (folder.status === "failed") return <span className={styles.lockedLabel} style={{ color: "#c43f50" }} title={folder.error_message || "Something went wrong preparing the Drive folder"}>⚠ Drive folder failed</span>;
  return null;
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
  // { [bundleId]: { status: "pending"|"creating"|"ready"|"failed", drive_folder_url, error_message } }
  const [driveFolders, setDriveFolders] = useState({});
  const [publishingBundleId, setPublishingBundleId] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [selectedEmotion, setSelectedEmotion] = useState("Happy");
  const [selectedNiche, setSelectedNiche] = useState("Reaction");
  const [bundleName, setBundleName] = useState("");
  const [bundleDescription, setBundleDescription] = useState("");
  const [bundleVideoIds, setBundleVideoIds] = useState([]);
  const [editingBundleId, setEditingBundleId] = useState(null);
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

      // Drive folder status for already-published bundles (RLS: creators can
      // only read the row for their own bundles — see migration).
      const publishedBundleIds = (bundlesRes.data || []).filter((b) => b.status === "published").map((b) => b.id);
      if (publishedBundleIds.length) {
        const { data: folders } = await supabase
          .from("bundle_drive_folders")
          .select("bundle_id, status, drive_folder_url, error_message")
          .in("bundle_id", publishedBundleIds);
        if (!cancelled && folders) {
          const grouped = {};
          for (const row of folders) grouped[row.bundle_id] = row;
          setDriveFolders(grouped);
        }
      }

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
  // Signed URLs for a creator's own (private) files, so they can preview
  // them in-studio. Always prefers the watermarked preview when available —
  // this is also roughly what a founder will eventually see. Falls back to
  // the original only if no watermarked version exists yet (still
  // processing, or watermarking failed) AND the original hasn't already
  // been moved to Drive-only storage.
  async function attachPreviewUrls(videoRows) {
    const withUrls = await Promise.all(
      videoRows.map(async (v) => {
        const previewPath = v.watermarked_storage_path || v.storage_path;
        const { data, error } = await supabase.storage
          .from(VIDEO_BUCKET)
          .createSignedUrl(previewPath, 3600);
        // A missing file (already moved to Drive-only, or never uploaded)
        // fails signing rather than silently showing the wrong video.
        return { ...v, previewUrl: error ? null : data?.signedUrl || null };
      })
    );
    return withUrls;
  }

  const stats = useMemo(() => ({
    videos: videos.length,
    bundles: bundles.length,
    publishedBundles: bundles.filter((bundle) => bundle.status === "published").length,
  }), [videos, bundles]);

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
      // drive-upload requires the creator's own session (it verifies they
      // own the video), so we must send the access token.
      supabase.auth.getSession().then(({ data: sessionData }) => {
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) return;
        return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ video_id: row.id }),
        });
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
    const locked = bundles.some((bundle) => bundle.status === "published" && (libraryVideoIds[bundle.library_id] || []).includes(id));
    if (locked) {
      window.alert("This video is part of a published bundle and is locked.");
      return;
    }
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

  function startNewBundle() {
    setEditingBundleId(null);
    setBundleName("");
    setBundleDescription("");
    setBundleVideoIds([]);
    setTab("bundles");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditingBundle(bundle) {
    if (bundle.status === "published") return;
    setEditingBundleId(bundle.id);
    setBundleName(bundle.name || "");
    setBundleDescription(bundle.description || "");
    setBundleVideoIds(libraryVideoIds[bundle.library_id] || []);
    setTab("bundles");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleBundleVideo(videoId) {
    setBundleVideoIds((current) => current.includes(videoId) ? current.filter((id) => id !== videoId) : [...current, videoId]);
  }

  async function saveBundle(event) {
    event.preventDefault();
    if (!bundleName.trim() || !creator || !bundleVideoIds.length) return;

    if (editingBundleId) {
      const bundle = bundles.find((item) => item.id === editingBundleId);
      if (!bundle || bundle.status === "published") return;
      const libraryId = bundle.library_id;
      const existingIds = libraryVideoIds[libraryId] || [];
      const selected = new Set(bundleVideoIds);
      const existing = new Set(existingIds);
      const toAdd = bundleVideoIds.filter((id) => !existing.has(id));
      const toRemove = existingIds.filter((id) => !selected.has(id));
      if (toAdd.length) {
        const { error } = await supabase.from("library_videos").insert(toAdd.map((video_id) => ({ library_id: libraryId, video_id })));
        if (error) return window.alert(`Couldn't update bundle videos: ${error.message}`);
      }
      if (toRemove.length) {
        const { error } = await supabase.from("library_videos").delete().eq("library_id", libraryId).in("video_id", toRemove);
        if (error) return window.alert(`Couldn't remove bundle videos: ${error.message}`);
      }
      const { data: updatedBundle, error: updateError } = await supabase.from("bundles").update({ name: bundleName.trim(), description: bundleDescription.trim() || null }).eq("id", bundle.id).select().single();
      if (updateError) return window.alert(`Couldn't save bundle: ${updateError.message}`);
      setLibraryVideoIds((current) => ({ ...current, [libraryId]: [...bundleVideoIds] }));
      setBundles((current) => current.map((item) => item.id === bundle.id ? updatedBundle : item));
      setEditingBundleId(null);
      setBundleName("");
      setBundleDescription("");
      setBundleVideoIds([]);
      return;
    }

    // Keep the existing database model intact: libraries/library_videos remain
    // the internal membership mechanism, while the dashboard no longer exposes
    // "libraries" as a product concept.
    const { data: library, error: libraryError } = await supabase.from("libraries").insert({
      creator_id: creator.id,
      name: bundleName.trim(),
      description: bundleDescription.trim() || null,
    }).select().single();
    if (libraryError) return window.alert(`Couldn't create bundle: ${libraryError.message}`);

    const { error: membershipError } = await supabase.from("library_videos").insert(bundleVideoIds.map((video_id) => ({ library_id: library.id, video_id })));
    if (membershipError) {
      await supabase.from("libraries").delete().eq("id", library.id);
      return window.alert(`Couldn't add videos to bundle: ${membershipError.message}`);
    }

    const { data: bundle, error: bundleError } = await supabase.from("bundles").insert({
      creator_id: creator.id,
      library_id: library.id,
      name: bundleName.trim(),
      description: bundleDescription.trim() || null,
    }).select().single();
    if (bundleError) {
      await supabase.from("library_videos").delete().eq("library_id", library.id);
      await supabase.from("libraries").delete().eq("id", library.id);
      return window.alert(`Couldn't create bundle: ${bundleError.message}`);
    }

    setLibraries((current) => [library, ...current]);
    setLibraryVideoIds((current) => ({ ...current, [library.id]: [...bundleVideoIds] }));
    setBundles((current) => [bundle, ...current]);
    setBundleName("");
    setBundleDescription("");
    setBundleVideoIds([]);
  }

  async function publishBundle(bundle) {
    if (bundle.status === "published") return;
    const ids = libraryVideoIds[bundle.library_id] || [];
    if (!ids.length) return window.alert("Add at least one video before publishing this bundle.");

    // Publishing locks the bundle at the database level (see the
    // bundle_locking_and_drive_folders migration): once status flips to
    // "published" here, video_count/price_cents freeze permanently and no
    // video can be added to or removed from it, even via a direct API call.
    setPublishingBundleId(bundle.id);
    const { error } = await supabase.from("bundles").update({ status: "published" }).eq("id", bundle.id);
    if (error) {
      setPublishingBundleId(null);
      return window.alert(`Couldn't publish bundle: ${error.message}`);
    }
    setBundles((current) => current.map((item) => item.id === bundle.id ? { ...item, status: "published" } : item));
    setDriveFolders((current) => ({ ...current, [bundle.id]: { status: "creating" } }));

    // Kick off the per-bundle Google Drive folder now that the content is
    // locked. The folder link itself is never shown to the creator's own
    // dashboard beyond a "ready" status — RLS gates the actual URL to
    // founders who've paid — but we still poll so the creator can see when
    // it's done.
    createBundleDriveFolder(bundle.id);
    setPublishingBundleId(null);
  }

  async function createBundleDriveFolder(bundleId, attempt = 0) {
    setDriveFolders((current) => ({ ...current, [bundleId]: { ...(current[bundleId] || {}), status: "creating" } }));
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-bundle-drive-folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ bundle_id: bundleId }),
      });
      const body = await res.json();

      if (!res.ok) {
        setDriveFolders((current) => ({ ...current, [bundleId]: { status: "failed", error_message: body.error } }));
        return;
      }

      setDriveFolders((current) => ({
        ...current,
        [bundleId]: { status: body.status, drive_folder_url: body.drive_folder_url, error_message: body.failed?.length ? body.failed.join("; ") : null },
      }));
    } catch (err) {
      // Transient network hiccup — retry a couple of times before giving up
      // and letting the creator know something needs attention.
      if (attempt < 2) {
        setTimeout(() => createBundleDriveFolder(bundleId, attempt + 1), 4000);
        return;
      }
      setDriveFolders((current) => ({ ...current, [bundleId]: { status: "failed", error_message: err.message } }));
    }
  }

  const previewBundlePrice = useMemo(() => ({
    count: bundleVideoIds.length,
    priceCents: bundleVideoIds.length * pricePerClipCents,
  }), [bundleVideoIds.length, pricePerClipCents]);

  if (loading) {
    return <div className={styles.wrap}><main className={styles.main}><p className={styles.subtitle}>Loading your studio…</p></main></div>;
  }

  if (!creator) {
    return <div className={styles.wrap}><main className={styles.main}><p className={styles.subtitle}>We couldn't find your creator profile. Try signing out and back in.</p></main></div>;
  }

  return (
    <div className={styles.wrap}>
      {(drawerOpen || notificationsOpen || walletOpen) && <button className={styles.backdrop} aria-label="Close" onClick={closePanels} />}

      <aside className={styles.sidebar}>
        <a href="/" className={`${styles.logo} ugcBrandMark`} aria-label="UGC Hub home"><span className="ugcBrandMark__ugc">UGC</span><span className="ugcBrandMark__hub">Hub</span></a>
        <nav className={styles.sidebarNav} aria-label="Creator navigation">
          <button className={tab === "overview" ? styles.sidebarItemActive : styles.sidebarItem} onClick={() => goTo("overview")}><span className={styles.navIcon}>⌂</span>Overview</button>
          <button className={tab === "videos" ? styles.sidebarItemActive : styles.sidebarItem} onClick={() => goTo("videos")}><span className={styles.navIcon}>▷</span>Videos <b>{stats.videos}</b></button>
          <button className={tab === "bundles" ? styles.sidebarItemActive : styles.sidebarItem} onClick={() => goTo("bundles")}><span className={styles.navIcon}>◈</span>Bundles <b>{stats.bundles}</b></button>
          <button className={styles.sidebarItem} onClick={() => openMenu("profile")}><span className={styles.navIcon}>⚙</span>Settings</button>
        </nav>
        <div className={styles.sidebarDivider} />
        <span className={styles.quickLabel}>Quick actions</span>
        <div className={styles.quickActions}>
          <button className={styles.quickAction} onClick={() => goTo("videos")}><span>↑</span>Upload Video</button>
          <button className={styles.quickAction} onClick={startNewBundle}><span>◈</span>Create Bundle</button>
        </div>
        <button className={styles.sidebarAccount} onClick={() => openMenu("profile")}>
          <span className={styles.accountAvatar}>{(creator?.display_name || user?.email || "C").charAt(0).toUpperCase()}</span>
          <span><strong>{creator?.display_name || "Creator"}</strong><small>{user?.email || "Creator account"}</small></span>
          <b>›</b>
        </button>
      </aside>

      <div className={styles.appArea}>
        <header className={styles.header}>
          <div className={styles.mobileBrand}><a href="/" className={`${styles.logo} ugcBrandMark`} aria-label="UGC Hub home"><span className="ugcBrandMark__ugc">UGC</span><span className="ugcBrandMark__hub">Hub</span></a></div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} aria-label="Wallet" aria-expanded={walletOpen} onClick={() => { closePanels(); setWalletOpen(true); }}><WalletIcon /></button>
            <button className={styles.iconButton} aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { closePanels(); setNotificationsOpen(true); }}><BellIcon /><span className={styles.notificationDot} /></button>
            <button className={styles.signOut} onClick={signOut}>Sign out</button>
          </div>
        </header>

        {walletOpen && <aside className={styles.notificationPanel} aria-label="Wallet"><div className={styles.panelHeader}><div><span className={styles.panelEyebrow}>Creator earnings</span><h2>Wallet</h2></div><button className={styles.closeButton} onClick={closePanels}>×</button></div><div className={styles.walletBalance}><span>Available balance</span><strong>$0.00</strong><small>Earnings and payout status will appear here once your bundles generate revenue.</small></div><button className={styles.walletAction} onClick={() => { setWalletOpen(false); openMenu("payouts"); }}>Set up payouts</button></aside>}
        {notificationsOpen && <aside className={styles.notificationPanel} aria-label="Notifications"><div className={styles.panelHeader}><div><span className={styles.panelEyebrow}>Updates</span><h2>Notifications</h2></div><button className={styles.closeButton} onClick={closePanels}>×</button></div><div className={styles.emptyState}><BellIcon /><strong>You're all caught up</strong><span>There are no new notifications.</span></div></aside>}

        <aside className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ""}`} aria-hidden={!drawerOpen}>
          <div className={styles.drawerHeader}><div><span className={styles.panelEyebrow}>Creator account</span><h2>Menu</h2></div><button className={styles.closeButton} onClick={closePanels}>×</button></div>
          <div className={styles.accountCard}><div className={styles.accountAvatar}>{(creator?.display_name || user?.email || "C").charAt(0).toUpperCase()}</div><div><strong>{creator?.display_name || "Creator"}</strong><span>{user?.email || "Creator account"}</span></div></div>
          <nav className={styles.drawerNav}>
            <button className={styles.drawerItem} onClick={() => setActivePanel("profile")}><span>Account information</span><b>›</b></button>
            <button className={styles.drawerItem} onClick={() => setActivePanel("payouts")}><span>Payouts</span><b>›</b></button>
          </nav>
          {activePanel && <div className={styles.drawerDetail}><span className={styles.panelEyebrow}>{activePanel === "profile" ? "Account" : "Payments"}</span><h3>{activePanel === "profile" ? "Account information" : "Payouts"}</h3><p>{activePanel === "profile" ? "Your creator account details and public profile settings will live here." : "Set up how UGC Hub should send your earnings. Your payout method will be stored securely when payments are connected."}</p>{activePanel === "payouts" && <button className={styles.walletAction}>Set up payout method</button>}</div>}
          <div className={styles.drawerFooter}><button className={`${styles.drawerItem} ${styles.deleteItem}`} onClick={handleDeleteAccount}><span>Delete account</span><b>›</b></button></div>
        </aside>

        <main className={styles.main}>
          <div className={styles.pageIntro}>
            <div><span className={styles.panelEyebrow}>Creator studio</span><h1 className={styles.title}>Good morning, {creator?.display_name || "Creator"} <span className={styles.sun}>☀</span></h1><p className={styles.subtitle}>Here's what's happening with your content today.</p></div>
          </div>

          {tab === "overview" && <section className={styles.studioSection}>
            <div className={styles.dashboardTop}>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}><div className={`${styles.statIcon} ${styles.statIconGreen}`}>▷</div><div><span>Total Videos</span><strong>{stats.videos}</strong><small>Content in your collection</small></div></div>
                <div className={styles.statCard}><div className={`${styles.statIcon} ${styles.statIconGold}`}>◈</div><div><span>Bundles</span><strong>{stats.bundles}</strong><small>{stats.publishedBundles} published</small></div></div>
                <div className={styles.statCard}><div className={`${styles.statIcon} ${styles.statIconPurple}`}>◇</div><div><span>Total Earnings</span><strong>$0.00</strong><small>Available balance</small></div></div>
              </div>
              <div className={styles.priceCard}><div className={styles.priceCardTop}><span className={styles.priceCheck}>✓</span><div><strong>Your Price</strong><small>per clip <button type="button" onClick={() => window.alert("Your platform clip price is currently configured by UGC Hub.")}>↗</button></small></div><span className={styles.activePrice}>Active</span></div><strong className={styles.priceValue}>{formatPrice(pricePerClipCents)}</strong></div>
            </div>

            <button className={styles.uploadHero} onClick={() => goTo("videos")}>
              <span className={styles.uploadHeroIcon}>↑</span><span><strong>Upload Your Video</strong><small>Add a video to your collection. Then create a bundle and set your price.</small></span><b>Upload Video</b>
            </button>

            <div className={styles.sectionCard}>
              <div className={styles.sectionHeading}><div><h2>Your Bundles</h2><p>Create bundles, set your price and publish them to start earning.</p></div><button className={styles.primaryAction} onClick={startNewBundle}><BundleIcon />Create Bundle</button></div>
              {!bundles.length ? <div className={styles.emptyCreatorState}><strong>No bundles yet</strong><span>Upload videos, select the clips you want, then create your first bundle.</span></div> : <div className={styles.bundleGrid}>{bundles.map((bundle) => {
                const ids = libraryVideoIds[bundle.library_id] || [];
                const thumbs = ids.map((id) => videos.find((video) => video.id === id)).filter(Boolean).slice(0, 3);
                return <article className={styles.bundleCard} key={bundle.id}>
                  <div className={styles.thumbStrip}>{thumbs.map((video) => video.previewUrl ? <video key={video.id} src={video.previewUrl} muted playsInline /> : <div key={video.id} className={styles.thumbPlaceholder} />)}</div>
                  <div className={styles.bundleCardBody}><div className={styles.bundleTop}><div><h3>{bundle.name}</h3><p>{ids.length} videos · {bundle.status === "published" ? "Public" : "Draft"}</p></div><strong>{formatPrice(bundle.price_cents || ids.length * pricePerClipCents)}</strong></div><div className={styles.bundleMeta}><span className={bundle.status === "published" ? styles.publishedBadge : styles.draftBadge}>{bundle.status === "published" ? "Published" : "Draft"}</span>{bundle.status === "published" ? <><span className={styles.lockedLabel}>🔒 Locked</span><DriveFolderStatus folder={driveFolders[bundle.id]} /></> : <><button onClick={() => startEditingBundle(bundle)}>Edit</button><button onClick={() => publishBundle(bundle)} disabled={publishingBundleId === bundle.id}>{publishingBundleId === bundle.id ? "Publishing…" : "Publish"}</button></>}</div></div>
                </article>;
              })}</div>}
            </div>

            <div className={styles.sectionCard}>
              <div className={styles.sectionHeading}><div><h2>Available Bundles</h2><p>These bundles are visible to your audience once published.</p></div><button className={styles.textAction} onClick={() => goTo("bundles")}>View all →</button></div>
              <div className={styles.availableGrid}>{bundles.filter((bundle) => bundle.status === "published").slice(0, 3).map((bundle) => { const ids = libraryVideoIds[bundle.library_id] || []; const thumbs = ids.map((id) => videos.find((video) => video.id === id)).filter(Boolean).slice(0, 4); return <div className={styles.availableCard} key={bundle.id}><div className={styles.availableThumbs}>{thumbs.map((video) => video.previewUrl ? <video key={video.id} src={video.previewUrl} muted playsInline /> : <div key={video.id} className={styles.thumbPlaceholder} />)}</div><div><strong>{bundle.name}</strong><small>{ids.length} videos</small></div><b>{formatPrice(bundle.price_cents || ids.length * pricePerClipCents)}</b></div>; })}</div>
              {!bundles.some((bundle) => bundle.status === "published") && <div className={styles.availableEmpty}>Publish a bundle and it will appear here.</div>}
            </div>
          </section>}

          {tab === "videos" && <section className={styles.studioSection}>
            <div className={styles.sectionHeading}><div><h2>Videos</h2><p>Upload your reaction clips. Videos can be added to one or more draft bundles before publishing.</p></div><button className={styles.primaryAction} onClick={() => fileInput.current?.click()} disabled={uploading}><UploadIcon />{uploading ? "Uploading…" : "Upload Video"}</button></div>
            <div className={styles.uploadControls}><label>Emotion<select value={selectedEmotion} onChange={(e) => setSelectedEmotion(e.target.value)}>{EMOTIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Niche<select value={selectedNiche} onChange={(e) => setSelectedNiche(e.target.value)}>{NICHES.map((item) => <option key={item}>{item}</option>)}</select></label><input ref={fileInput} hidden type="file" accept="video/*" multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} /></div>
            {uploadError && <p style={{ color: "#c43f50", fontSize: 12.5 }}>{uploadError}</p>}
            <button className={styles.dropzone} onClick={() => fileInput.current?.click()} disabled={uploading}><span className={styles.dropzoneIcon}>↑</span><strong>{uploadStatus || "Drop videos here or click to upload"}</strong><small>MP4, MOV, WebM · 9:16 reaction clips recommended · watermarking runs in your browser and may take a few seconds per clip</small></button>
            {!videos.length ? <div className={styles.emptyCreatorState}><strong>No videos yet</strong><span>Upload your first reaction clips to start building bundles.</span></div> : <div className={styles.videoGrid}>{videos.map((video) => <article key={video.id} className={styles.videoCard}>{video.previewUrl ? <video src={video.previewUrl} muted controls playsInline /> : <div className={styles.videoPlaceholder}>Video</div>}<div className={styles.videoCardBody}><div className={styles.videoCardTop}><div><h3>{video.name}</h3><span>{video.filename}</span></div><button className={styles.moreButton} onClick={() => removeVideo(video.id)} aria-label={`Remove ${video.name}`} disabled={bundles.some((bundle) => bundle.status === "published" && (libraryVideoIds[bundle.library_id] || []).includes(video.id))}>{bundles.some((bundle) => bundle.status === "published" && (libraryVideoIds[bundle.library_id] || []).includes(video.id)) ? "🔒" : "×"}</button></div><div className={styles.pillRow}><span className={styles.pill}>{video.emotion}</span><span className={`${styles.pill} ${styles.pillViolet}`}>{video.niche}</span>{video.processing_status === "pending" && <span className={styles.pill} style={{ background: "#fff3cd", color: "#8a6d00" }}>Watermark pending</span>}{video.processing_status === "failed" && <span className={styles.pill} style={{ background: "#fde2e2", color: "#c43f50" }}>Watermark failed</span>}</div></div></article>)}</div>}
          </section>}

          {tab === "bundles" && <section className={styles.studioSection}>
            <div className={styles.sectionHeading}><div><h2>{editingBundleId ? "Edit Bundle" : "Create Bundle"}</h2><p>Select the videos you want, name the bundle, then publish it when it is finished. Published bundles are permanently locked.</p></div>{editingBundleId && <button className={styles.secondaryAction} onClick={startNewBundle}>Cancel edit</button>}</div>
            <form className={styles.bundleBuilder} onSubmit={saveBundle}>
              <div className={styles.formGrid}><label>Bundle name<input value={bundleName} onChange={(e) => setBundleName(e.target.value)} placeholder="e.g. Beach Vibes Pack" /></label><label>Description<input value={bundleDescription} onChange={(e) => setBundleDescription(e.target.value)} placeholder="What founders get in this bundle" /></label></div>
              <div className={styles.builderHeader}><div><strong>Select videos</strong><span>{bundleVideoIds.length} selected · {formatPrice(previewBundlePrice.priceCents)} bundle value</span></div></div>
              {!videos.length ? <div className={styles.emptyCreatorState}><strong>Upload videos first</strong><span>Your uploaded videos will appear here for bundle selection.</span></div> : <div className={styles.selectVideoGrid}>{videos.map((video) => { const selected = bundleVideoIds.includes(video.id); return <button type="button" key={video.id} className={selected ? styles.selectVideoActive : styles.selectVideo} onClick={() => toggleBundleVideo(video)}><span className={styles.selectVideoMedia}>{video.previewUrl ? <video src={video.previewUrl} muted playsInline /> : <span>Video</span>}</span><span><strong>{video.name}</strong><small>{video.emotion} · {video.niche}</small></span><i>{selected ? "✓" : "+"}</i></button>; })}</div>}
              <div className={styles.formFooter}><span>Your price is {formatPrice(pricePerClipCents)} per clip · {bundleVideoIds.length ? formatPrice(previewBundlePrice.priceCents) : "$0.00"} total</span><button className={styles.primaryAction} type="submit" disabled={!bundleName.trim() || !bundleVideoIds.length}>{editingBundleId ? "Save Bundle" : "Create Bundle"}</button></div>
            </form>

            <div className={styles.sectionCard}><div className={styles.sectionHeading}><div><h2>Your Bundles</h2><p>Finish draft bundles, then publish to lock their video selection.</p></div></div>{!bundles.length ? <div className={styles.emptyCreatorState}><strong>No bundles yet</strong><span>Your finished bundles will appear here.</span></div> : <div className={styles.bundleGrid}>{bundles.map((bundle) => { const ids = libraryVideoIds[bundle.library_id] || []; return <article className={styles.bundleListCard} key={bundle.id}><div><strong>{bundle.name}</strong><span>{ids.length} videos · {bundle.status === "published" ? "Published and locked" : "Draft"}</span></div><b>{formatPrice(bundle.price_cents || ids.length * pricePerClipCents)}</b>{bundle.status === "published" ? <div className={styles.bundleListActions}><span className={styles.lockedLabel}>🔒 Locked</span><DriveFolderStatus folder={driveFolders[bundle.id]} />{(!driveFolders[bundle.id] || driveFolders[bundle.id].status === "failed" || driveFolders[bundle.id].status === "pending") && <button onClick={() => createBundleDriveFolder(bundle.id)}>{driveFolders[bundle.id]?.status === "failed" ? "Retry Drive folder" : "Set up Drive folder"}</button>}</div> : <div className={styles.bundleListActions}><button onClick={() => startEditingBundle(bundle)}>Edit</button><button onClick={() => publishBundle(bundle)} disabled={publishingBundleId === bundle.id}>{publishingBundleId === bundle.id ? "Publishing…" : "Publish"}</button></div>}</article>; })}</div>}</div>
          </section>}
        </main>
      </div>
    </div>
  );
}