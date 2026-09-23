import { useEffect, useMemo, useState } from "react";
import styles from "./Landing.module.css";
import { supabase } from "./supabaseClient";

/**
 * NOTE ON DATA ACCESS
 * Anonymous visitors can read: creators (status='active'), videos (status='published'),
 * and bundles/libraries (status='published') — these tables have public SELECT policies.
 * Actual video files in the `creator-videos` storage bucket require an `authenticated`
 * session (see storage policies), so signed-out visitors see a poster/placeholder card
 * with a play affordance rather than a playing clip. Signing in unlocks real preview
 * playback inside the modal — this mirrors the mockup's static-preview card pattern.
 */

const REACTION_FILTERS = ["All", "Shocked", "Excited", "Confused", "Happy", "Crying", "Frustrated", "Skeptical", "Relaxed"];

const FAQS = [
  { q: "Why not just use stock UGC clips?", a: "Stock UGC gets reused across brands. UGC Hub is built around real creators you can identify and work with directly, so you can build a consistent library around one face instead of buying the same recycled footage everyone else has." },
  { q: "What am I actually buying?", a: "A bundle of clean, short-form facial reaction clips from one creator. Choose a creator, see their reactions and niches, select a bundle, and get the clips for your own content production." },
  { q: "Can I use the clips commercially?", a: "Yes. The bundle is intended for use in your brand's social content and advertising. Usage terms can be agreed directly with the creator for the specific bundle." },
  { q: "Are these AI-generated faces?", a: "No. The marketplace is for real people creating real facial reaction footage. No synthetic faces and no stolen content." },
];

function goToSignIn() {
  window.location.href = "/sign-in";
}

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h12v18l-6-4-6 4V3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** Poster placeholder: a gradient tile with the creator's initials, standing in for a
 * real thumbnail until a signed-in session can render the actual watermarked preview. */
function PosterTile({ label, seed = 0, className }) {
  const hues = [["#4f46e5", "#a855f7"], ["#ec4899", "#f59e0b"], ["#0ea5e9", "#22d3ee"], ["#22c55e", "#84cc16"]];
  const [a, b] = hues[seed % hues.length];
  return (
    <div className={className} style={{ background: `linear-gradient(150deg, ${a}, ${b})`, display: "grid", placeItems: "center" }}>
      <span style={{ fontSize: 34, fontWeight: 800, color: "rgba(255,255,255,.85)", letterSpacing: "-.03em" }}>{label}</span>
    </div>
  );
}

export default function Landing() {
  const [creators, setCreators] = useState([]);
  const [bundlesByCreator, setBundlesByCreator] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [activeFilter, setActiveFilter] = useState("All");
  const [heroFilter, setHeroFilter] = useState("All");
  const [openFaq, setOpenFaq] = useState(null);
  const [pricingPeriod, setPricingPeriod] = useState("bundle"); // "bundle" | "subscription"
  const [previewCreator, setPreviewCreator] = useState(null);
  const [showCreatorForm, setShowCreatorForm] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      const { data: creatorRows, error: creatorErr } = await supabase
        .from("creators")
        .select("id, display_name, contact_handle, avatar_url, reactions, niches")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (creatorErr) {
        setLoadError(creatorErr.message);
        setLoading(false);
        return;
      }

      const ids = (creatorRows || []).map((c) => c.id);
      let videoCounts = {};
      let bundleRows = [];
      if (ids.length) {
        const [{ data: videos }, { data: bundles }] = await Promise.all([
          supabase.from("videos").select("creator_id").eq("status", "published").in("creator_id", ids),
          supabase.from("bundles").select("id, creator_id, name, video_count, price_cents").eq("status", "published").in("creator_id", ids),
        ]);
        (videos || []).forEach((v) => {
          videoCounts[v.creator_id] = (videoCounts[v.creator_id] || 0) + 1;
        });
        bundleRows = bundles || [];
      }

      if (cancelled) return;
      setCreators((creatorRows || []).map((c) => ({ ...c, publishedClipCount: videoCounts[c.id] || 0 })));
      const grouped = {};
      bundleRows.forEach((b) => {
        grouped[b.creator_id] = grouped[b.creator_id] || [];
        grouped[b.creator_id].push(b);
      });
      setBundlesByCreator(grouped);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredCreators = useMemo(() => {
    if (activeFilter === "All") return creators;
    return creators.filter((c) => (c.reactions || []).includes(activeFilter));
  }, [creators, activeFilter]);

  const heroPreviewCreators = useMemo(() => {
    const pool = heroFilter === "All" ? creators : creators.filter((c) => (c.reactions || []).includes(heroFilter));
    return pool.slice(0, 3);
  }, [creators, heroFilter]);

  function showToast(message) {
    setToast(message);
    window.clearTimeout(window.__ugcToastTimer);
    window.__ugcToastTimer = window.setTimeout(() => setToast(null), 3200);
  }

  function handleBookmark(e, creator) {
    e.stopPropagation();
    showToast(`Saved ${creator.display_name} to your shortlist`);
  }

  function handleCreatorFormSubmit(e) {
    e.preventDefault();
    setShowCreatorForm(false);
    showToast("Thanks — we'll be in touch about onboarding you.");
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden="true"><span /><span /><span /></div>
      <div className={styles.grid} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">🎬</span>
            <span className={styles.brandName}>
              UGC Hub
              <span className={styles.brandTag}>Beta</span>
            </span>
          </div>
          <nav className={styles.nav}>
            <a href="#marketplace">Creators</a>
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className={styles.headerActions}>
            <button className={styles.btnGhost} onClick={goToSignIn}>Sign in</button>
            <button className={styles.btnPrimary} onClick={goToSignIn}>Browse creators</button>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.badge}><span className={styles.badgeDot} />{loading ? "Loading live creators…" : `${creators.length} active creator${creators.length === 1 ? "" : "s"} right now`}</span>
            <h1 className={styles.heroHeadline}>
              Buy a library of reactions.<br />
              <span className={styles.heroGradient}>Keep the same face.</span>
            </h1>
            <p className={styles.heroSub}>
              Get 50 or 100 high-quality facial reaction clips from <b>one real creator</b>. Browse by emotion and niche,
              choose a face that fits your brand, and build a consistent UGC library — no creator hunting, no mismatched footage.
            </p>
            <div className={styles.heroCtas}>
              <button className={styles.btnPrimary} onClick={goToSignIn}>Browse creators</button>
              <button className={styles.btnGlass} onClick={() => setShowCreatorForm(true)}>Become a creator</button>
            </div>
            <div className={styles.heroPills}>
              <div><span className={styles.pillDot}>●</span>Real people</div>
              <div><span className={styles.pillDot}>●</span>9:16 clips</div>
              <div><span className={styles.pillDot}>●</span>50–100 clips / bundle</div>
              <div><span className={styles.pillDot}>●</span>Commercial use</div>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.heroVisualGlow} aria-hidden="true" />
            <div className={styles.filterBar}>
              {["All", "Shocked", "Excited", "Happy"].map((f) => (
                <button key={f} className={f === heroFilter ? "active" : ""} onClick={() => setHeroFilter(f)}>{f}</button>
              ))}
            </div>
            <div className={styles.heroCards}>
              {!loading && heroPreviewCreators.length === 0 && (
                <p style={{ color: "#9aa0b4", fontSize: 13 }}>No creators match that reaction yet.</p>
              )}
              {heroPreviewCreators.map((creator, i) => {
                const posClass = i === 0 ? styles.heroCardLeft : i === 1 ? styles.heroCardCenter : styles.heroCardRight;
                const sizeClass = i === 1 ? "" : styles.heroCardSide;
                return (
                  <div
                    key={creator.id}
                    className={`${styles.heroCard} ${sizeClass} ${posClass}`}
                    onClick={() => setPreviewCreator(creator)}
                    role="button"
                    tabIndex={0}
                  >
                    <PosterTile label={initials(creator.display_name)} seed={i} className="" />
                    <div className={styles.cardShade} />
                    <span className={styles.cardTop}>Live</span>
                    <div className={styles.cardFoot}>
                      <strong>{creator.display_name}</strong>
                      <span>{creator.publishedClipCount}+ clips</span>
                    </div>
                    <div className={styles.playDot}><span className={styles.playCircle}><PlayIcon /></span></div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="marketplace" className={styles.section}>
          <div className={styles.directoryTop}>
            <div>
              <span className={styles.kicker}>Marketplace</span>
              <h2 className={styles.sectionHeadline}>Find the face your brand needs.</h2>
              <p className={styles.sectionSub}>Every creator has a defined reaction library, niches, and video count.</p>
            </div>
            <div className={styles.filterChips}>
              {REACTION_FILTERS.map((f) => (
                <button key={f} className={f === activeFilter ? "active" : ""} onClick={() => setActiveFilter(f)}>{f}</button>
              ))}
            </div>
          </div>

          <div className={styles.creatorGrid}>
            {loading && <p style={{ color: "#9aa0b4" }}>Loading creators…</p>}
            {!loading && loadError && (
              <div className={styles.emptyState}>Couldn't load creators right now ({loadError}). Try refreshing.</div>
            )}
            {!loading && !loadError && filteredCreators.length === 0 && (
              <div className={styles.emptyState}>No creators match "{activeFilter}" yet — check back soon or try another reaction.</div>
            )}
            {!loading && !loadError && filteredCreators.map((creator, i) => (
              <article key={creator.id} className={styles.creatorCard}>
                <div className={styles.creatorMedia} onClick={() => setPreviewCreator(creator)} role="button" tabIndex={0}>
                  <PosterTile label={initials(creator.display_name)} seed={i} className="" />
                  <div className={styles.mediaShade} />
                  <span className={styles.mediaTag}>{creator.contact_handle || "Creator"}</span>
                  <button className={styles.bookmark} onClick={(e) => handleBookmark(e, creator)} aria-label="Save creator"><BookmarkIcon /></button>
                  <div className={styles.mediaFoot}>
                    <span className={styles.clipPill}>{creator.publishedClipCount}+ clips</span>
                    <span className={styles.ratingPill}><StarIcon />New</span>
                  </div>
                </div>
                <div className={styles.creatorInfo}>
                  <h3>{creator.display_name}</h3>
                  <p>{(creator.niches || []).slice(0, 2).join(" · ") || "General"}</p>
                  <div className={styles.creatorBottom}>
                    <span>{(creator.reactions || []).length} reactions</span>
                    <button onClick={goToSignIn}>View creator <ChevronIcon /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className={styles.section}>
          <div className={styles.sectionCenter}>
            <span className={`${styles.kicker} ${styles.kickerViolet}`}>How it works</span>
            <h2 className={styles.sectionHeadline}>From creator to content in minutes.</h2>
            <p className={styles.sectionSub}>No production shoot, no casting call — just a library that's already made.</p>
          </div>
          <div className={styles.steps}>
            <div className={styles.stepCard}>
              <div className={styles.stepNum} style={{ background: "linear-gradient(135deg,#4f46e5,#818cf8)" }}>1</div>
              <h3>Pick a creator</h3>
              <p>Browse real people by their face, reactions, niches, and available clip bundles.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNum} style={{ background: "linear-gradient(135deg,#a855f7,#ec4899)" }}>2</div>
              <h3>Choose your bundle</h3>
              <p>Buy a ready-made set of 50 or 100 reaction clips from that creator.</p>
            </div>
            <div className={styles.stepCard}>
              <div className={styles.stepNum} style={{ background: "linear-gradient(135deg,#0ea5e9,#22d3ee)" }}>3</div>
              <h3>Make your content</h3>
              <p>Drop your product demo, screen recording, or footage underneath the reaction clips.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className={styles.section}>
          <div className={styles.sectionCenter}>
            <span className={`${styles.kicker} ${styles.kickerEmerald}`}>Simple pricing</span>
            <h2 className={styles.sectionHeadline}>A complete reaction library, not a single clip.</h2>
            <p className={styles.sectionSub}>Buy the amount you actually need and keep your content consistent across campaigns.</p>
            <div className={styles.pricingToggle}>
              <button className={pricingPeriod === "bundle" ? "active" : ""} onClick={() => setPricingPeriod("bundle")}>One-time bundle</button>
              <button className={pricingPeriod === "subscription" ? "active" : ""} onClick={() => setPricingPeriod("subscription")}>
                Ongoing access <span className={styles.saveBadge}>New libraries monthly</span>
              </button>
            </div>
          </div>
          <div className={styles.bundles}>
            <div className={styles.bundleCard}>
              <div className={styles.bundleTop}>
                <div><h3>Starter</h3><p>One creator · Multiple reactions</p></div>
                <div className={styles.bundlePrice}><strong>$22</strong><span>{pricingPeriod === "subscription" ? "first bundle" : "one-time"}</span></div>
              </div>
              <ul className={styles.bundleList}>
                <li><CheckIcon />50 short-form reaction videos</li>
                <li><CheckIcon />Multiple emotions from one face</li>
                <li><CheckIcon />9:16 social-ready format</li>
                <li><CheckIcon />Built for ads and organic content</li>
              </ul>
              <button className={styles.bundleBtn} onClick={goToSignIn}>Browse 50-clip bundles</button>
            </div>
            <div className={`${styles.bundleCard} ${styles.bundleFeatured}`}>
              <span className={styles.bundleBadge}>Best value</span>
              <div className={styles.bundleTop}>
                <div><h3>Full library</h3><p>One creator · Complete reaction bank</p></div>
                <div className={styles.bundlePrice}><strong>$40</strong><span>{pricingPeriod === "subscription" ? "first bundle" : "one-time"}</span></div>
              </div>
              <ul className={styles.bundleList}>
                <li><CheckIcon />100 short-form reaction videos</li>
                <li><CheckIcon />Broader emotion coverage</li>
                <li><CheckIcon />9:16 social-ready format</li>
                <li><CheckIcon />Best value for recurring campaigns</li>
              </ul>
              <button className={`${styles.bundleBtn} ${styles.bundleBtnFilled}`} onClick={goToSignIn}>Browse 100-clip bundles</button>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 30, flexWrap: "wrap" }}>
            <div>
              <span className={styles.kicker}>For creators</span>
              <h2 className={styles.sectionHeadline} style={{ marginTop: 16 }}>Your face is the product.</h2>
              <p className={styles.sectionSub}>Turn your reaction range into a repeatable product. Upload your clips once and let brands buy your libraries.</p>
            </div>
            <button className={styles.btnPrimary} onClick={() => setShowCreatorForm(true)}>Become a creator</button>
          </div>
        </section>

        <section id="faq" className={styles.section} style={{ maxWidth: 780 }}>
          <span className={styles.kicker}>FAQ</span>
          <h2 className={styles.sectionHeadline} style={{ marginTop: 16 }}>Questions.</h2>
          <div className={styles.faqList} style={{ marginTop: 30 }}>
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q} className={styles.faqItem}>
                  <button className={`${styles.faqQ} ${open ? styles.faqQOpen : ""}`} onClick={() => setOpenFaq(open ? null : i)} aria-expanded={open}>
                    <span>{f.q}</span>
                    <ChevronIcon />
                  </button>
                  {open && <p className={styles.faqA}>{f.a}</p>}
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.finalCta}>
          <div className={styles.finalInner}>
            <h2>Ready to stop hunting for creators every campaign?</h2>
            <p>Pick one face, buy the whole reaction bank, and keep every piece of UGC on-brand.</p>
            <button className={styles.finalBtn} onClick={goToSignIn}>Browse creators</button>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><span>🎬</span>UGC Hub</div>
        <span>Real reactions. Consistent faces. Better UGC.</span>
        <div className={styles.footerLinks}>
          <a href="#marketplace">Creators</a>
          <a href="#faq">FAQ</a>
          <a href="/sign-in" onClick={(e) => { e.preventDefault(); goToSignIn(); }}>Get started →</a>
        </div>
      </footer>

      {previewCreator && (
        <div className={styles.modalOverlay} onClick={() => setPreviewCreator(null)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setPreviewCreator(null)} aria-label="Close preview">✕</button>
            <div className={styles.modalMedia}>
              <PosterTile label={initials(previewCreator.display_name)} seed={0} className="" />
              <div className={styles.modalMediaShade} />
              <div className={styles.modalMediaInfo}>
                <span className={styles.modalTag}>Sign in to preview</span>
                <h3>{previewCreator.display_name}</h3>
                <p>{(previewCreator.reactions || []).join(" · ")}</p>
              </div>
            </div>
            <div className={styles.modalFoot}>
              <div>
                <span>Available now</span>
                <strong>{previewCreator.publishedClipCount}+ published clips</strong>
              </div>
              <button className={styles.modalCta} onClick={goToSignIn}>Browse bundles</button>
            </div>
          </div>
        </div>
      )}

      {showCreatorForm && (
        <div className={styles.modalOverlay} onClick={() => setShowCreatorForm(false)}>
          <form className={styles.formCard} onClick={(e) => e.stopPropagation()} onSubmit={handleCreatorFormSubmit}>
            <button className={styles.modalClose} onClick={() => setShowCreatorForm(false)} aria-label="Close form" type="button">✕</button>
            <h3>Become a creator</h3>
            <p>Tell us a bit about your content — we'll follow up about onboarding and your first library.</p>
            <div className={styles.formField}>
              <label htmlFor="creator-name">Name</label>
              <input id="creator-name" type="text" placeholder="Your name" required />
            </div>
            <div className={styles.formField}>
              <label htmlFor="creator-handle">Social handle</label>
              <input id="creator-handle" type="text" placeholder="@yourhandle" required />
            </div>
            <div className={styles.formField}>
              <label htmlFor="creator-niche">Primary niche</label>
              <select id="creator-niche" defaultValue="">
                <option value="" disabled>Select a niche</option>
                <option>AI tools</option>
                <option>Productivity</option>
                <option>Fintech</option>
                <option>Social apps</option>
                <option>Dating</option>
                <option>Ecommerce</option>
                <option>Mobile games</option>
                <option>Education</option>
              </select>
            </div>
            <button className={styles.formSubmit} type="submit">Submit application</button>
          </form>
        </div>
      )}

      <div className={`${styles.toast} ${toast ? styles.toastShow : ""}`} role="status" aria-live="polite">
        <span className={styles.toastIcon}><CheckIcon /></span>
        {toast}
      </div>
    </div>
  );
}