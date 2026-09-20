import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clapperboard, Star } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/AuthContext";
import styles from "./Dashboard.module.css";
import profile from "./CreatorProfile.module.css";

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Read-only row of 5 stars. `value` may be fractional; we round to nearest half
// visually by filling whole stars only (simple + unambiguous at small sizes).
function Stars({ value, size = 14 }) {
  const filled = Math.round(value);
  return (
    <span className={profile.stars} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} strokeWidth={1.8} fill={n <= filled ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

// Clickable 5-star input for the review form.
function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <span className={profile.starInput} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={profile.starBtn}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
        >
          <Star size={22} strokeWidth={1.8} fill={n <= (hover || value) ? "currentColor" : "none"} />
        </button>
      ))}
    </span>
  );
}

export default function CreatorProfile({ creatorId, onBack, onOpenBundle }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [creator, setCreator] = useState(null);
  const [introUrl, setIntroUrl] = useState(null);
  const [stats, setStats] = useState(null); // { avg_rating, review_count }
  const [bundles, setBundles] = useState([]);
  const [bundleCovers, setBundleCovers] = useState({}); // { [bundleId]: signedUrl }
  const [reviews, setReviews] = useState([]);
  const [founderId, setFounderId] = useState(null);
  const [purchasedBundleIds, setPurchasedBundleIds] = useState(new Set());
  const [reviewedBundleIds, setReviewedBundleIds] = useState(new Set()); // bundles THIS founder already reviewed

  // review form
  const [formBundleId, setFormBundleId] = useState("");
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  async function load() {
    const [creatorRes, statsRes, bundlesRes, reviewsRes, founderRes, introRes] = await Promise.all([
      supabase.from("creators_public").select("*").eq("id", creatorId).maybeSingle(),
      supabase.from("creator_rating_stats").select("*").eq("creator_id", creatorId).maybeSingle(),
      supabase.from("bundles_public").select("*").eq("creator_id", creatorId).order("created_at", { ascending: false }),
      supabase.from("creator_reviews_public").select("*").eq("creator_id", creatorId).order("created_at", { ascending: false }),
      supabase.from("founders").select("id").eq("user_id", user.id).maybeSingle(),
      supabase.from("creator_intro_clips").select("watermarked_storage_path").eq("creator_id", creatorId).maybeSingle(),
    ]);

    if (!creatorRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setCreator(creatorRes.data);
    setStats(statsRes.data || null);
    setBundles(bundlesRes.data || []);
    setReviews(reviewsRes.data || []);
    setFounderId(founderRes.data?.id || null);

    // Intro clip: signed URL for the watermarked preview only.
    if (introRes.data?.watermarked_storage_path) {
      const { data: signed, error } = await supabase.storage
        .from("creator-videos")
        .createSignedUrl(introRes.data.watermarked_storage_path, 3600);
      if (error) console.warn("Intro clip signing failed:", error.message);
      setIntroUrl(signed?.signedUrl || null);
    }

    // Bundle covers: first watermarked clip of each bundle.
    const ids = (bundlesRes.data || []).map((b) => b.id);
    if (ids.length) {
      const { data: clips } = await supabase
        .from("bundle_preview_clips")
        .select("bundle_id, watermarked_storage_path")
        .in("bundle_id", ids);
      const firstPerBundle = {};
      for (const c of clips || []) if (!firstPerBundle[c.bundle_id]) firstPerBundle[c.bundle_id] = c.watermarked_storage_path;
      const entries = await Promise.all(
        Object.entries(firstPerBundle).map(async ([bundleId, path]) => {
          const { data: signed } = await supabase.storage.from("creator-videos").createSignedUrl(path, 3600);
          return [bundleId, signed?.signedUrl || null];
        })
      );
      setBundleCovers(Object.fromEntries(entries));
    }

    // Which of THIS creator's bundles has the viewer bought? Drives the review form.
    if (founderRes.data?.id && ids.length) {
      const { data: purchases } = await supabase
        .from("bundle_purchases")
        .select("bundle_id")
        .eq("founder_id", founderRes.data.id)
        .eq("status", "succeeded")
        .in("bundle_id", ids);
      setPurchasedBundleIds(new Set((purchases || []).map((p) => p.bundle_id)));

      // Which of those has this founder already reviewed? (unique per bundle)
      const { data: mine } = await supabase
        .from("reviews")
        .select("bundle_id")
        .eq("founder_id", founderRes.data.id)
        .eq("creator_id", creatorId);
      setReviewedBundleIds(new Set((mine || []).map((r) => r.bundle_id)));
    }

    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    load();
    window.scrollTo({ top: 0 });
  }, [creatorId]);

  // Bundles this founder bought from this creator and hasn't reviewed yet.
  const reviewable = bundles.filter((b) => purchasedBundleIds.has(b.id) && !reviewedBundleIds.has(b.id));

  useEffect(() => {
    if (!formBundleId && reviewable.length) setFormBundleId(reviewable[0].id);
  }, [reviewable.length]);

  async function submitReview(e) {
    e.preventDefault();
    setFormError(null);
    if (!formBundleId) return setFormError("Choose which bundle you're reviewing.");
    if (!formRating) return setFormError("Tap a star rating first.");

    setSaving(true);
    const { error } = await supabase.from("reviews").insert({
      creator_id: creatorId,
      bundle_id: formBundleId,
      founder_id: founderId,
      rating: formRating,
      comment: formComment.trim() || null,
    });
    setSaving(false);

    if (error) {
      // 23505 = unique_violation (already reviewed this bundle)
      setFormError(error.code === "23505" ? "You've already reviewed this bundle." : "Couldn't post your review. Please try again.");
      return;
    }

    setFormRating(0);
    setFormComment("");
    setFormBundleId("");
    await load(); // refresh list + aggregate rating
  }

  if (loading) {
    return (
      <div className={profile.page}>
        <div className={profile.skelHero} aria-hidden="true" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={profile.page}>
        <button className={styles.backLink} onClick={onBack}>
          <ArrowLeft size={13} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: 5 }} />All creators
        </button>
        <div className={styles.emptyCreatorState}>
          <strong>Creator not found</strong>
          <span>This creator may have paused or removed their profile.</span>
        </div>
      </div>
    );
  }

  const avg = stats ? Number(stats.avg_rating) : 0;

  return (
    <div className={profile.page}>
      <button className={styles.backLink} onClick={onBack}>
        <ArrowLeft size={13} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: 5 }} />All creators
      </button>

      {/* ---------- Hero ---------- */}
      <section className={profile.hero}>
        <div className={profile.introBox}>
          {introUrl ? (
            <video className={profile.introVideo} src={introUrl} controls autoPlay loop muted playsInline preload="metadata" />
          ) : (
            <div className={profile.introEmpty}>
              <Clapperboard size={26} strokeWidth={1.5} />
              <span>No intro clip yet</span>
            </div>
          )}
        </div>

        <div className={profile.heroInfo}>
          <div className={profile.identity}>
            <div className={styles.avatar} style={{ width: 56, height: 56, flexBasis: 56, fontSize: 20, borderRadius: 12 }}>
              {creator.avatar_url ? <img src={creator.avatar_url} alt="" /> : (creator.display_name || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className={profile.name}>{creator.display_name}</h1>
              <span className={styles.cardSub}>Reaction creator · Joined {formatDate(creator.created_at)}</span>
            </div>
          </div>

          <div className={profile.ratingRow}>
            {stats ? (
              <>
                <Stars value={avg} size={16} />
                <strong>{avg.toFixed(1)}</strong>
                <span>{stats.review_count} review{stats.review_count === 1 ? "" : "s"}</span>
              </>
            ) : (
              <span className={profile.noRating}>No reviews yet</span>
            )}
          </div>

          {creator.bio && <p className={profile.bio}>{creator.bio}</p>}

          {creator.reactions?.length > 0 && (
            <div>
              <span className={styles.pillLabel}>Reactions</span>
              <div className={styles.pillRow}>{creator.reactions.map((r) => <span key={r} className={styles.pill}>{r}</span>)}</div>
            </div>
          )}
          {creator.niches?.length > 0 && (
            <div>
              <span className={styles.pillLabel}>Niches</span>
              <div className={styles.pillRow}>{creator.niches.map((n) => <span key={n} className={`${styles.pill} ${styles.pillViolet}`}>{n}</span>)}</div>
            </div>
          )}

          <div className={profile.statStrip}>
            <div><b>{bundles.length}</b><span>Bundles</span></div>
            <div><b>{bundles.reduce((sum, b) => sum + (b.video_count || 0), 0)}</b><span>Clips</span></div>
            <div><b>{stats ? stats.review_count : 0}</b><span>Reviews</span></div>
          </div>
        </div>
      </section>

      {/* ---------- Bundles ---------- */}
      <section className={profile.section}>
        <div className={profile.sectionHead}>
          <h2>Bundles</h2>
          <span>{bundles.length} available</span>
        </div>

        {bundles.length === 0 ? (
          <div className={styles.emptyCreatorState}>
            <strong>No bundles published yet</strong>
            <span>{creator.display_name} hasn't published a clip bundle. Check back soon.</span>
          </div>
        ) : (
          <div className={styles.grid}>
            {bundles.map((b) => {
              const owned = purchasedBundleIds.has(b.id);
              return (
                <div
                  key={b.id}
                  className={`${styles.creatorCard} ${styles.bundleCardClickable}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenBundle?.(b.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") onOpenBundle?.(b.id); }}
                >
                  <div className={styles.coverWrap}>
                    {bundleCovers[b.id] ? (
                      <video className={styles.cover} src={`${bundleCovers[b.id]}#t=0.5`} preload="metadata" muted playsInline />
                    ) : (
                      <div className={styles.coverEmpty}><Clapperboard size={22} strokeWidth={1.6} /></div>
                    )}
                    <span className={styles.clipBadge}>{b.video_count} clips</span>
                  </div>
                  <div>
                    <h3>{b.name}</h3>
                  </div>
                  {b.description && <p className={styles.bio}>{b.description}</p>}
                  <div className={styles.libraryMeta}>
                    <strong>{formatPrice(b.price_cents)}</strong>
                    {owned
                      ? <span className={styles.ownedTag}><Check size={13} strokeWidth={2.5} />Purchased</span>
                      : <span className={styles.viewLink}>View bundle <ArrowRight size={12} strokeWidth={2.25} style={{ verticalAlign: "-1px" }} /></span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- Reviews ---------- */}
      <section className={profile.section}>
        <div className={profile.sectionHead}>
          <h2>Reviews</h2>
          <span>{stats ? `${avg.toFixed(1)} average · ${stats.review_count} total` : "No reviews yet"}</span>
        </div>

        {reviewable.length > 0 && (
          <form className={profile.reviewForm} onSubmit={submitReview}>
            <strong>Leave a review</strong>
            <span className={profile.formHint}>You purchased from {creator.display_name}, so you can share how it went.</span>

            {reviewable.length > 1 && (
              <select value={formBundleId} onChange={(e) => setFormBundleId(e.target.value)} className={profile.select}>
                {reviewable.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            {reviewable.length === 1 && <span className={profile.formBundle}>Reviewing: <b>{reviewable[0].name}</b></span>}

            <StarInput value={formRating} onChange={setFormRating} />
            <textarea
              className={profile.textarea}
              placeholder="What was it like working with these clips? (optional)"
              maxLength={1000}
              rows={3}
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
            />
            {formError && <p className={styles.errorText} style={{ margin: 0 }}>{formError}</p>}
            <button className={styles.primaryAction} type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
              {saving ? "Posting…" : "Post review"}
            </button>
          </form>
        )}

        {reviews.length === 0 ? (
          <div className={styles.emptyCreatorState}>
            <strong>No reviews yet</strong>
            <span>Reviews come from founders who bought a bundle. Be the first once you've purchased one.</span>
          </div>
        ) : (
          <div className={profile.reviewList}>
            {reviews.map((r) => (
              <article key={r.id} className={profile.review}>
                <div className={profile.reviewTop}>
                  <div className={profile.reviewer}>
                    <div className={styles.avatar} style={{ width: 32, height: 32, flexBasis: 32, fontSize: 12 }}>
                      {(r.reviewer_company || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong>{r.reviewer_company || "Founder"}</strong>
                      <span>on {r.bundle_name} · {formatDate(r.created_at)}</span>
                    </div>
                  </div>
                  <Stars value={r.rating} />
                </div>
                {r.comment && <p>{r.comment}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
