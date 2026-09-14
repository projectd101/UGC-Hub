import { useState } from "react";
import styles from "./Landing.module.css";

const REACTIONS = [
  { label: "Shocked", tilt: -6, tone: "coral" },
  { label: "Excited", tilt: 3, tone: "violet" },
  { label: "Confused", tilt: -2, tone: "coral" },
];

const FOUNDER_STEPS = [
  {
    n: "Post what you need",
    d: "Shocked reaction, no audio, 9:16. Set a budget. Takes two minutes.",
  },
  {
    n: "Creators respond",
    d: "Real people with real profiles apply with clips that already fit.",
  },
  {
    n: "Deal directly",
    d: "Message, pay, and download straight from the creator. No middleman fees on the transaction.",
  },
];

const CREATOR_STEPS = [
  {
    n: "Build a profile",
    d: "Upload your reaction clips once. Shock, excitement, confusion — whatever you've got.",
  },
  {
    n: "Get discovered",
    d: "Founders browse profiles and send requests straight to you.",
  },
  {
    n: "Get paid directly",
    d: "No revenue share. You set your price, you keep what you charge.",
  },
];

const FAQS = [
  {
    q: "Why not just use stock UGC clips?",
    a: "Stock clips get resold to dozens of brands. The same face ends up on ten different apps in the same week, and anyone who's seen more than one starts to notice. Every creator here is a real, findable person — one face per brand, not one face rented out everywhere.",
  },
  {
    q: "Does UGC Hub take a cut of what I pay a creator?",
    a: "No. Founders and creators deal directly — you agree on price and pay each other, nothing routes through us.",
  },
  {
    q: "How does UGC Hub make money, then?",
    a: "Creators pay a flat monthly plan to be visible to founders and to browse requests. Founders don't pay us anything.",
  },
  {
    q: "What kind of clips are we talking about?",
    a: "Clean 9:16 face reactions — shocked, excited, confused, and so on. No audio, no script, no talking. You drop your own screen recording or demo underneath it.",
  },
];

function goToSignIn() {
  window.location.href = "/sign-in";
}

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.logo}>UGC Hub</span>
          <nav className={styles.nav}>
            <a href="#how-it-works">How it works</a>
            <a href="#creators">For creators</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className={styles.headerActions}>
            <button className={styles.ghostBtn} onClick={goToSignIn}>
              Sign in
            </button>
            <button className={styles.primaryBtn} onClick={goToSignIn}>
              Post a request
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroHeadline}>
              Real reactions.
              <br />
              One face per brand.
            </h1>
            <p className={styles.heroSub}>
              Founders post what they need. Creators respond with clips
              already shot. You deal directly — no stolen footage, no faces
              your audience has already seen on someone else's ad.
            </p>
            <div className={styles.heroCtas}>
              <button className={styles.primaryBtn} onClick={goToSignIn}>
                I'm a founder
              </button>
              <button className={styles.secondaryBtn} onClick={goToSignIn}>
                I'm a creator
              </button>
            </div>
          </div>

          <div className={styles.heroCards}>
            {REACTIONS.map((r) => (
              <div
                key={r.label}
                className={`${styles.reelCard} ${styles[r.tone]}`}
                style={{ "--tilt": `${r.tilt}deg` }}
              >
                <div className={styles.reelFace} aria-hidden="true" />
                <span className={styles.reelLabel}>{r.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* PROBLEM */}
        <section className={styles.problem}>
          <div className={styles.problemGrid}>
            <div className={styles.problemCol}>
              <span className={styles.problemTag}>The problem</span>
              <h2 className={styles.problemHeadline}>
                Same face, ten different apps.
              </h2>
              <p className={styles.problemBody}>
                Generic UGC bundles resell the same clip to dozens of
                founders. Post it, and someone in your audience has already
                seen that person "react" to three other apps this month. It
                reads as fake because, functionally, it is.
              </p>
            </div>
            <div className={styles.problemCol}>
              <span className={styles.problemTag} style={{ color: "var(--violet)" }}>
                The fix
              </span>
              <h2 className={styles.problemHeadline}>
                One creator, working with you.
              </h2>
              <p className={styles.problemBody}>
                Every profile on UGC Hub is a real person you can message.
                Hire them once for a batch, or keep working with the same
                face as your brand's recurring reaction — your call, direct
                with them.
              </p>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className={styles.how}>
          <h2 className={styles.sectionHeadline}>How it works</h2>
          <div className={styles.howLanes}>
            <div className={styles.lane}>
              <span className={styles.laneTag}>For founders</span>
              <ol className={styles.laneList}>
                {FOUNDER_STEPS.map((s) => (
                  <li key={s.n}>
                    <h3>{s.n}</h3>
                    <p>{s.d}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className={styles.laneDivider} aria-hidden="true" />
            <div className={styles.lane}>
              <span className={styles.laneTag} style={{ color: "var(--violet)" }}>
                For creators
              </span>
              <ol className={styles.laneList}>
                {CREATOR_STEPS.map((s) => (
                  <li key={s.n}>
                    <h3>{s.n}</h3>
                    <p>{s.d}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* CREATORS CTA STRIP */}
        <section id="creators" className={styles.creatorStrip}>
          <div className={styles.creatorStripInner}>
            <div>
              <h2 className={styles.creatorHeadline}>
                Got a good shocked face?
              </h2>
              <p className={styles.creatorSub}>
                Turn it into recurring income. Set up a profile, upload your
                reactions once, and let founders come to you.
              </p>
            </div>
            <button className={styles.primaryBtn} onClick={goToSignIn}>
              Apply as a creator
            </button>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className={styles.faq}>
          <h2 className={styles.sectionHeadline}>Questions</h2>
          <div className={styles.faqList}>
            {FAQS.map((f, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={f.q} className={styles.faqItem}>
                  <button
                    className={styles.faqQ}
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    <span>{f.q}</span>
                    <span className={styles.faqIcon}>{isOpen ? "–" : "+"}</span>
                  </button>
                  {isOpen && <p className={styles.faqA}>{f.a}</p>}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>UGC Hub</span>
        <span className={styles.footerDim}>
          Founders and creators, dealing directly.
        </span>
      </footer>
    </div>
  );
}
