import { useAuth } from "../lib/AuthContext";
import styles from "./SignIn.module.css";

export default function SignIn() {
  const { signInWithGoogle } = useAuth();

  return (
    <main className={styles.page}>
      <section className={styles.visual} aria-label="UGC Hub creator reactions">
        <video className={styles.video} src="/videos/111.mp4" autoPlay muted loop playsInline preload="auto" />
        <div className={styles.visualShade} />
        <div className={styles.visualContent}>
          <span className={styles.visualKicker}>UGC Hub</span>
          <h1>One face.<br />A whole reaction bank.</h1>
          <p>Real reactions built for brands that want content people recognize.</p>
        </div>
        <span className={styles.visualMark}>REAL PEOPLE · REAL REACTIONS</span>
      </section>

      <section className={styles.auth}>
        <div className={styles.authInner}>
          <a href="/" className={styles.logo} aria-label="UGC Hub home"><span>UGC</span><b>Hub</b></a>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Welcome to UGC Hub</span>
            <h2>Get started.</h2>
            <p>Choose how you want to use UGC Hub.</p>
          </div>
          <div className={styles.cards}>
            <button className={`${styles.card} ${styles.founder}`} onClick={() => signInWithGoogle("founder")}>
              <span className={styles.cardTop}><span className={styles.tag}>FOR FOUNDERS</span><span className={styles.arrow}>↗</span></span>
              <strong>Find your creator</strong>
              <p>Browse real faces and buy ready-made reaction libraries for your content.</p>
              <span className={styles.google}>Continue with Google</span>
            </button>
            <button className={`${styles.card} ${styles.creator}`} onClick={() => signInWithGoogle("creator")}>
              <span className={styles.cardTop}><span className={styles.tag}>FOR CREATORS</span><span className={styles.arrow}>↗</span></span>
              <strong>Become a creator</strong>
              <p>Turn your reactions into a library brands can discover and buy.</p>
              <span className={styles.google}>Continue with Google</span>
            </button>
          </div>
          <p className={styles.fine}>By continuing, you agree to use UGC Hub with an account type selected for your workflow.</p>
        </div>
      </section>
    </main>
  );
}
