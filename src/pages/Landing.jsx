import { useState } from "react";
import styles from "./Landing.module.css";

const CREATORS = [
  { name: "Alex Morgan", handle: "@alexmorgan", reactions: ["Shocked", "Excited", "Confused", "Happy"], niches: ["AI tools", "Productivity", "Fintech"], clips: 100, price: 49, videos: ["/videos/11.mp4", "/videos/22.mp4"] },
  { name: "Mia Carter", handle: "@miacarter", reactions: ["Excited", "Happy", "Skeptical", "Crying"], niches: ["Social apps", "Dating", "Ecommerce"], clips: 100, price: 59, videos: ["/videos/33.mp4"] },
  { name: "Jordan Lee", handle: "@jordanlee", reactions: ["Shocked", "Frustrated", "Confused", "Relaxed"], niches: ["Mobile games", "Education", "AI tools"], clips: 50, price: 29, videos: ["/videos/44.mp4"] },
];
const REACTIONS = ["Shocked", "Excited", "Confused", "Happy", "Crying", "Frustrated", "Skeptical", "Relaxed"];
const NICHES = ["AI tools", "Productivity", "Fintech", "Dating", "Mobile games", "Health & wellness", "Social apps", "Ecommerce", "Education"];
const FAQS = [
  { q: "Why not just use stock UGC clips?", a: "Stock UGC gets reused across brands. UGC Hub is built around real creators you can identify and work with directly, so you can build a consistent library around one face instead of buying the same recycled footage everyone else has." },
  { q: "What am I actually buying?", a: "A bundle of clean, short-form facial reaction clips from one creator. Choose a creator, see their reactions and niches, select a bundle, and get the clips for your own content production." },
  { q: "Can I use the clips commercially?", a: "Yes. The bundle is intended for use in your brand's social content and advertising. Usage terms can be agreed directly with the creator for the specific bundle." },
  { q: "Are these AI-generated faces?", a: "No. The marketplace is for real people creating real facial reaction footage. No synthetic faces and no stolen content." },
];
function goToSignIn() { window.location.href = "/sign-in"; }

function CreatorPreview({ creator }) {
  const [videoIndex, setVideoIndex] = useState(0);
  const hasMultipleVideos = creator.videos.length > 1;
  const src = creator.videos[videoIndex];
  return (
    <div className={styles.creatorPreview}>
      <video
        key={src}
        className={styles.previewVideo}
        src={src}
        autoPlay
        muted
        playsInline
        loop={!hasMultipleVideos}
        preload="metadata"
        onEnded={hasMultipleVideos ? () => setVideoIndex((i) => (i + 1) % creator.videos.length) : undefined}
        aria-label={`${creator.name} reaction preview`}
      />
      <div className={styles.previewReaction}>{creator.reactions[0]}</div>
      {hasMultipleVideos && <div className={styles.previewCount}>{videoIndex + 1} / {creator.videos.length}</div>}
      <div className={styles.previewMuted}>MUTED</div>
    </div>
  );
}

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(null);
  const [reactionFilter, setReactionFilter] = useState("All");
  const [nicheFilter, setNicheFilter] = useState("All");
  const filteredCreators = CREATORS.filter((creator) => (reactionFilter === "All" || creator.reactions.includes(reactionFilter)) && (nicheFilter === "All" || creator.niches.includes(nicheFilter)));
  return (
    <div className={styles.page}>
      <header className={styles.header}><div className={styles.headerInner}>
        <span className={`${styles.logo} ugcBrandMark`} aria-label="UGC Hub"><span className="ugcBrandMark__ugc">UGC</span><span className="ugcBrandMark__hub">Hub</span></span>
        <nav className={styles.nav}><a href="#marketplace">Examples</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></nav>
        <div className={styles.headerActions}><button className={styles.ghostBtn} onClick={goToSignIn}>Sign in</button><button className={styles.primaryBtn} onClick={goToSignIn}>Browse creators</button></div>
      </div></header>
      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}><span className={styles.eyebrow}>THE UGC MARKETPLACE FOR REAL REACTIONS</span><h1 className={`${styles.heroHeadline} landingHeroHeadline`}>Buy a library of reactions.<br /><em>Keep the same face.</em></h1><p className={styles.heroSub}>Get 50 or 100 high-quality facial reaction clips from one real creator. Browse by emotion and niche, choose a face that fits your brand, and build a consistent UGC library.</p><div className={styles.heroCtas}><button className={styles.primaryBtn} onClick={goToSignIn}>Browse creators</button><button className={`${styles.secondaryBtn} landingCreatorButton`} onClick={goToSignIn}>Become a creator</button></div><div className={styles.heroProof}><span>REAL PEOPLE</span><span>9:16 CLIPS</span><span>50–100 CLIPS / BUNDLE</span><span>COMMERCIAL USE</span></div></div>
          <div className={styles.heroVisual}>
            <div className={`${styles.videoTile} ${styles.tileOne}`}><video src="/videos/1.mp4" autoPlay muted loop playsInline preload="metadata" /></div>
            <div className={`${styles.videoTile} ${styles.tileTwo}`}><video src="/videos/2.mp4" autoPlay muted loop playsInline preload="metadata" /></div>
            <div className={`${styles.videoTile} ${styles.tileThree}`}><video src="/videos/3.mp4" autoPlay muted loop playsInline preload="metadata" /></div>
          </div>
        </section>
        <section id="marketplace" className={styles.marketplace}><div className={styles.sectionTop}><div><span className={styles.sectionKicker}>THE MARKETPLACE</span><h2 className={styles.sectionHeadline}>Find the face your brand needs.</h2><p className={styles.sectionSub}>Every creator has a defined reaction library, niches, clip count, and bundle price.</p></div><button className={styles.textBtn} onClick={goToSignIn}>View all creators →</button></div>
          <div className={styles.filters}><div className={styles.filterGroup}><span>Reaction</span><select value={reactionFilter} onChange={(e) => setReactionFilter(e.target.value)}><option>All</option>{REACTIONS.map((r) => <option key={r}>{r}</option>)}</select></div><div className={styles.filterGroup}><span>Niche</span><select value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)}><option>All</option>{NICHES.map((n) => <option key={n}>{n}</option>)}</select></div></div>
          <div className={styles.creatorGrid}>{filteredCreators.map((creator) => <article key={creator.handle} className={styles.creatorCard}><CreatorPreview creator={creator} /><div className={styles.creatorInfo}><div className={styles.creatorIdentity}><div className={styles.avatar}>{creator.name.split(" ").map((n) => n[0]).join("")}</div><div><h3>{creator.name}</h3><span>{creator.handle}</span></div></div><div className={styles.tagRow}>{creator.reactions.map((r) => <span key={r} className={styles.tag}>{r}</span>)}</div><div className={styles.tagRow}>{creator.niches.map((n) => <span key={n} className={styles.nicheTag}>{n}</span>)}</div><div className={styles.cardBottom}><div><strong>{creator.clips}</strong><span> clips</span></div><div><strong>${creator.price}</strong><span> / bundle</span></div><button onClick={goToSignIn}>View creator</button></div></div></article>)}</div>
        </section>
        <section className={styles.reactionExplorer}><div className={styles.explorerCopy}><span className={styles.sectionKicker}>REACTION LIBRARY</span><h2 className={styles.sectionHeadline}>One creator. Dozens of emotions.</h2><p className={styles.sectionSub}>Stop searching for a new person every time you need a different reaction. Build a complete bank around a face that fits your product.</p></div><div className={styles.reactionGrid}>{REACTIONS.map((reaction, i) => <button key={reaction} className={styles.reactionItem} onClick={goToSignIn}><span className={styles.reactionNumber}>0{i + 1}</span><strong>{reaction}</strong><span>View clips →</span></button>)}</div></section>
        <section className={styles.compare}><div className={styles.compareCol}><span className={styles.sectionKicker}>THE OLD WAY</span><h2>Different face every time.</h2><ul><li>Search for creators for every campaign</li><li>Inconsistent look and audience recognition</li><li>Generic stock UGC gets reused everywhere</li><li>Hard to build a recognizable content identity</li></ul></div><div className={styles.compareColAccent}><span className={styles.sectionKicker}>UGC HUB</span><h2>One face. A whole reaction bank.</h2><ul><li>Choose a creator once</li><li>Buy 50 or 100 clips in one bundle</li><li>Multiple emotions from the same person</li><li>Keep your brand's UGC visually consistent</li></ul></div></section>
        <section id="how-it-works" className={styles.how}><span className={styles.sectionKicker}>HOW IT WORKS</span><h2 className={styles.sectionHeadline}>From creator to content in minutes.</h2><div className={styles.steps}><div><span>01</span><h3>Pick a creator</h3><p>Browse real people by their face, reactions, niches, and available clip bundles.</p></div><div><span>02</span><h3>Choose your bundle</h3><p>Buy a ready-made set of 50 or 100 reaction clips from that creator.</p></div><div><span>03</span><h3>Make your content</h3><p>Drop your product demo, screen recording, or footage underneath the reaction clips.</p></div></div></section>
        <section id="pricing" className={styles.bundleSection}><div className={styles.bundleCopy}><span className={styles.sectionKicker}>SIMPLE PRICING</span><h2 className={styles.sectionHeadline}>A complete reaction library, not a single clip.</h2><p className={styles.sectionSub}>Buy the amount you actually need and keep your content consistent across campaigns.</p></div><div className={styles.bundleCards}><article><span>STARTER</span><strong>50 clips</strong><b>$29</b><small>One creator · Multiple reactions</small><button onClick={goToSignIn}>Browse 50-clip bundles</button></article><article className={styles.featuredBundle}><span>FULL LIBRARY</span><strong>100 clips</strong><b>$49</b><small>One creator · Complete reaction bank</small><button onClick={goToSignIn}>Browse 100-clip bundles</button></article></div></section>
        <section className={styles.rights}><div><span className={styles.sectionKicker}>BUILT FOR BRANDS</span><h2>Use the clips where your audience already is.</h2></div><div className={styles.rightsGrid}><div><strong>Social</strong><span>Reels, TikTok, Shorts</span></div><div><strong>Ads</strong><span>Paid social and performance creative</span></div><div><strong>Product</strong><span>Demos, launches, landing pages</span></div><div><strong>Consistent</strong><span>The same recognizable face across campaigns</span></div></div></section>
        <section className={styles.creatorCta}><div><span className={styles.sectionKicker}>FOR CREATORS</span><h2>Your face is the product.</h2><p>Turn your reaction range into a repeatable product. Upload your clips once and let brands buy your libraries.</p></div><button className={styles.primaryBtn} onClick={goToSignIn}>Become a creator</button></section>
        <section id="faq" className={styles.faq}><span className={styles.sectionKicker}>FAQ</span><h2 className={styles.sectionHeadline}>Questions.</h2><div className={styles.faqList}>{FAQS.map((f, i) => { const open = openFaq === i; return <div key={f.q} className={styles.faqItem}><button className={styles.faqQ} onClick={() => setOpenFaq(open ? null : i)} aria-expanded={open}><span>{f.q}</span><span>{open ? "–" : "+"}</span></button>{open && <p className={styles.faqA}>{f.a}</p>}</div>; })}</div></section>
      </main>
      <footer className={styles.footer}><span>UGC Hub</span><span>Real reactions. Consistent faces. Better UGC.</span><button onClick={goToSignIn}>Get started →</button></footer>
    </div>
  );
}
