import { useState } from "react";
import {
  ArrowRight,
  Check,
  Layers3,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import styles from "./Landing.module.css";

const CREATORS = [
  { id: "alex-11", name: "Alex Morgan", handle: "@creator", reactions: ["Shocked", "Excited", "Confused", "Happy"], niches: ["AI tools", "Productivity", "Fintech"], clips: 100, videos: ["/videos/11.mp4"] },
  { id: "alex-22", name: "Alex Morgan", handle: "@creator", reactions: ["Shocked", "Excited", "Confused", "Happy"], niches: ["AI tools", "Productivity", "Fintech"], clips: 200, videos: ["/videos/22.mp4"] },
  { id: "mia-33", name: "Mia Carter", handle: "@creator", reactions: ["Excited", "Happy", "Skeptical", "Crying"], niches: ["Social apps", "Dating", "Ecommerce"], clips: 150, videos: ["/videos/33.mp4"] },
  { id: "jordan-44", name: "Jordan Lee", handle: "@creator", reactions: ["Shocked", "Frustrated", "Confused", "Relaxed"], niches: ["Mobile games", "Education", "AI tools"], clips: 100, videos: ["/videos/44.mp4"] },
];

const REACTIONS = [
  "Shocked",
  "Excited",
  "Confused",
  "Happy",
  "Crying",
  "Frustrated",
  "Skeptical",
  "Relaxed",
];

const FAQS = [
  {
    q: "Why not just use stock UGC clips?",
    a: "Stock UGC gets reused across brands. UGC Hub is built around real creators you can identify and work with directly, so you can build a consistent library around one face instead of buying the same recycled footage everyone else has.",
  },
  {
    q: "What am I actually buying?",
    a: "A bundle of clean, short form facial reaction clips from one creator. Choose a creator, see their reactions and niches, select a bundle, and get the clips for your own content production.",
  },
  {
    q: "Can I use the clips commercially?",
    a: "Yes. The bundle is intended for use in your brand's social content and advertising. Usage terms can be agreed directly with the creator for the specific bundle.",
  },
  {
    q: "Are these AI generated faces?",
    a: "No. The marketplace is for real people creating real facial reaction footage. No synthetic faces and no stolen content.",
  },
];

function goToSignIn() {
  window.location.href = "/sign-in";
}

function BrandMark() {
  return (
    <span className={styles.brandMark} aria-label="UGC Hub">
      <span className={styles.brandUgc}>UGC</span>
      <span className={styles.brandHub}>Hub</span>
    </span>
  );
}

function HeroTile({ className, src, label, duration }) {
  return (
    <div className={`${styles.heroTile} ${className}`}>
      <video src={src} autoPlay muted loop playsInline preload="metadata" />
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileDuration}>
        <Play size={9} fill="currentColor" />
        {duration}
      </span>
    </div>
  );
}

function CreatorPreview({ creator }) {
  return (
    <div className={styles.creatorPreview}>
      <video
        className={styles.previewVideo}
        src={creator.videos[0]}
        autoPlay
        muted
        playsInline
        loop
        preload="metadata"
        aria-label={`${creator.name} reaction preview`}
      />
    </div>
  );
}

function Feature({ icon: Icon, title, text }) {
  return (
    <div className={styles.feature}>
      <Icon size={19} strokeWidth={1.7} />
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="/" className={styles.logoLink}>
            <BrandMark />
          </a>

          <nav className={styles.nav}>
            <a href="#marketplace">Examples</a>
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className={styles.headerActions}>
            <button className={styles.signInBtn} onClick={goToSignIn}>
              Sign in
            </button>
            <button className={styles.headerBrowseBtn} onClick={goToSignIn}>
              Browse creators
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              THE UGC MARKETPLACE FOR REAL REACTIONS
            </span>

            <h1 className={styles.heroHeadline}>
              Buy a library of
              <br />
              reactions.
              <br />
              <em>Keep the same face.</em>
            </h1>

            <p className={styles.heroSub}>
              Get 50 or 100 high quality facial reaction clips from one real
              creator. Browse by emotion and niche, choose a face that fits
              your brand, and build a consistent UGC library. No creator
              hunting, no mismatched footage, just a ready to use reaction
              bank built around a face your audience can recognize.
            </p>

            <div className={styles.heroCtas}>
              <button className={styles.heroPrimaryBtn} onClick={goToSignIn}>
                Browse creators
                <ArrowRight size={16} />
              </button>
              <button className={styles.heroSecondaryBtn} onClick={goToSignIn}>
                Become a creator
              </button>
            </div>

            <div className={styles.heroFeatures}>
              <Feature icon={Users} title="Real people" text="Not AI. Actual creators." />
              <Feature icon={Video} title="9:16 clips" text="Perfect for Reels & Shorts." />
              <Feature icon={Layers3} title="50–100 clips / bundle" text="More reactions, more options." />
              <Feature icon={ShieldCheck} title="Commercial use" text="Use in your ads & content." />
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.handwrittenNote}>
              <span>Same face.</span>
              <span>Different emotions.</span>
              <span className={styles.handArrow}>↘</span>
            </div>

            <HeroTile
              className={styles.tileOne}
              src="/videos/1.mp4"
              label="Confused"
              duration="0:12"
            />

            <HeroTile
              className={styles.tileTwo}
              src="/videos/2.mp4"
              label="Shocked"
              duration="0:09"
            />

            <HeroTile
              className={styles.tileThree}
              src="/videos/3.mp4"
              label="Surprised"
              duration="0:14"
            />

            <div className={styles.authenticBadge}>
              <Sparkles size={14} />
              <span>Authentic reactions</span>
            </div>

            <div className={styles.bundleBadge}>
              <Video size={17} />
              <span>50–100 clips per bundle</span>
            </div>

            <span className={`${styles.scribble} ${styles.scribbleOne}`}>〰</span>
            <span className={`${styles.scribble} ${styles.scribbleTwo}`}>〰</span>
            <span className={`${styles.scribble} ${styles.scribbleThree}`}>〰</span>
          </div>
        </section>

        <section id="marketplace" className={styles.marketplace}>
          <div className={styles.sectionTop}>
            <div>
              <span className={styles.sectionKicker}>MARKETPLACE</span>
              <h2 className={styles.sectionHeadline}>Find the face your brand needs.</h2>
              <p className={styles.sectionSub}>
                Every creator has a defined reaction library, niches, and video count.
              </p>
            </div>
            <button className={styles.textBtn} onClick={goToSignIn}>
              View all creators <ArrowRight size={14} />
            </button>
          </div>

          <div className={styles.creatorGrid}>
            {CREATORS.map((creator) => (
              <article key={creator.id} className={styles.creatorCard}>
                <CreatorPreview creator={creator} />
                <div className={styles.creatorInfo}>
                  <div className={styles.creatorIdentity}>
                    <span>{creator.handle}</span>
                  </div>
                  <div className={styles.tagRow}>
                    {creator.reactions.map((reaction) => (
                      <span key={reaction} className={styles.tag}>
                        {reaction}
                      </span>
                    ))}
                  </div>
                  <div className={styles.tagRow}>
                    {creator.niches.map((niche) => (
                      <span key={niche} className={styles.nicheTag}>
                        {niche}
                      </span>
                    ))}
                  </div>
                  <div className={styles.cardBottom}>
                    <div>
                      <strong>{creator.clips}+</strong>
                      <span> videos</span>
                    </div>
                    <button onClick={goToSignIn}>View creator</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.reactionExplorer}>
          <div className={styles.explorerCopy}>
            <span className={styles.sectionKicker}>REACTION LIBRARY</span>
            <h2 className={styles.sectionHeadline}>One creator. Dozens of emotions.</h2>
            <p className={styles.sectionSub}>
              Stop searching for a new person every time you need a different reaction.
              Build a complete bank around a face that fits your product.
            </p>
          </div>

          <div className={styles.reactionGrid}>
            {REACTIONS.map((reaction, i) => (
              <button
                key={reaction}
                className={styles.reactionItem}
                onClick={goToSignIn}
              >
                <span className={styles.reactionNumber}>0{i + 1}</span>
                <strong>{reaction}</strong>
                <span>View clips <ArrowRight size={12} /></span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.compare}>
          <article className={styles.compareCol}>
            <header className={styles.compareHeader}>
              <span className={styles.sectionKicker}>THE OLD WAY</span>
              <h2>Different face every time.</h2>
            </header>
            <ul>
              <li><Check size={14} />Search for creators for every campaign</li>
              <li><Check size={14} />Inconsistent look and audience recognition</li>
              <li><Check size={14} />Generic stock UGC gets reused everywhere</li>
              <li><Check size={14} />Hard to build a recognizable content identity</li>
            </ul>
          </article>

          <article className={styles.compareColAccent}>
            <header className={styles.compareHeader}>
              <span className={styles.sectionKicker}>UGC HUB</span>
              <h2>One face. A whole reaction bank.</h2>
            </header>
            <ul>
              <li><Check size={14} />Choose a creator once</li>
              <li><Check size={14} />Buy 50 or 100 clips in one bundle</li>
              <li><Check size={14} />Multiple emotions from the same person</li>
              <li><Check size={14} />Keep your brand's UGC visually consistent</li>
            </ul>
          </article>
        </section>

        <section id="how-it-works" className={styles.how}>
          <span className={styles.sectionKicker}>HOW IT WORKS</span>
          <h2 className={styles.sectionHeadline}>From creator to content in minutes.</h2>
          <div className={styles.steps}>
            <div>
              <span>01</span>
              <h3>Pick a creator</h3>
              <p>Browse real people by their face, reactions, niches, and available clip bundles.</p>
            </div>
            <div>
              <span>02</span>
              <h3>Choose your bundle</h3>
              <p>Buy a ready made set of 50 or 100 reaction clips from that creator.</p>
            </div>
            <div>
              <span>03</span>
              <h3>Make your content</h3>
              <p>Drop your product demo, screen recording, or footage underneath the reaction clips.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className={styles.bundleSection}>
          <div className={styles.bundleCopy}>
            <span className={styles.sectionKicker}>SIMPLE PRICING</span>
            <h2 className={styles.sectionHeadline}>A complete reaction library, not a single clip.</h2>
            <p className={styles.sectionSub}>
              Buy the amount you actually need and keep your content consistent across campaigns.
            </p>
          </div>

          <div className={styles.bundleCards}>
            <article>
              <div className={styles.bundleCardTop}>
                <span>Starter</span>
                <strong>50 clips</strong>
                <b>$22</b>
                <small>One creator · Multiple reactions</small>
              </div>
              <ul className={styles.bundleFeatures}>
                <li>50 short form reaction videos</li>
                <li>Multiple emotions from one face</li>
                <li>9:16 social ready format</li>
                <li>Built for ads and organic content</li>
              </ul>
              <button onClick={goToSignIn}>Browse 50 clip bundles</button>
            </article>

            <article className={styles.featuredBundle}>
              <div className={styles.bundleCardTop}>
                <span>Full library</span>
                <strong>100 clips</strong>
                <b>$40</b>
                <small>One creator · Complete reaction bank</small>
              </div>
              <ul className={styles.bundleFeatures}>
                <li>100 short form reaction videos</li>
                <li>Broader emotion coverage</li>
                <li>9:16 social ready format</li>
                <li>Best value for recurring campaigns</li>
              </ul>
              <button onClick={goToSignIn}>Browse 100 clip bundles</button>
            </article>
          </div>
        </section>

        <section className={styles.rights}>
          <div>
            <span className={styles.sectionKicker}>BUILT FOR BRANDS</span>
            <h2>Use the clips where your audience already is.</h2>
          </div>
          <div className={styles.rightsGrid}>
            <div><strong>Social</strong><span>Reels, TikTok, Shorts</span></div>
            <div><strong>Ads</strong><span>Paid social and performance creative</span></div>
            <div><strong>Product</strong><span>Demos, launches, landing pages</span></div>
            <div><strong>Consistent</strong><span>The same recognizable face across campaigns</span></div>
          </div>
        </section>

        <section className={styles.creatorCta}>
          <div>
            <span className={styles.sectionKicker}>FOR CREATORS</span>
            <h2>Your face is the product.</h2>
            <p>Turn your reaction range into a repeatable product. Upload your clips once and let brands buy your libraries.</p>
          </div>
          <button className={styles.heroPrimaryBtn} onClick={goToSignIn}>
            Become a creator <ArrowRight size={16} />
          </button>
        </section>

        <section id="faq" className={styles.faq}>
          <span className={styles.sectionKicker}>FREQUENTLY ASKED QUESTIONS</span>
          <h2 className={styles.sectionHeadline}>Questions.</h2>
          <div className={styles.faqList}>
            {FAQS.map((faq, i) => {
              const open = openFaq === i;
              return (
                <div key={faq.q} className={styles.faqItem}>
                  <button
                    className={styles.faqQ}
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                  >
                    <span>{faq.q}</span>
                    <span>{open ? "−" : "+"}</span>
                  </button>
                  {open && <p className={styles.faqA}>{faq.a}</p>}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>UGC Hub</span>
        <span>Real reactions. Consistent faces. Better UGC.</span>
        <button onClick={goToSignIn}>
          Get started <ArrowRight size={13} />
        </button>
      </footer>
    </div>
  );
}
