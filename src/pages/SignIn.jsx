import { useAuth } from "../lib/AuthContext";
import styles from "./SignIn.module.css";

export default function SignIn() {
  const { signInWithGoogle } = useAuth();

  return (
    <main className={styles.page}>
      <section className={styles.auth}>
        <div className={styles.authInner}>
          <div className={styles.authCard}>
            <div className={styles.videoFrame}>
              <video
                className={styles.video}
                src="/videos/111.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              />
              <a href="/" className={styles.videoLogo} aria-label="UGC Hub home">
                <span>UGC</span><b>Hub</b>
              </a>
              <h1 className={styles.videoTitle}>
                Real Reactions for Founders
                <br />
                Real Money for Creators
              </h1>
            </div>

            <div className={styles.cardBody}>
              <p className={styles.continueLabel}>Continue as</p>

              <div className={styles.choice}>
                <button className={styles.option} onClick={() => signInWithGoogle("founder")}>
                  Founder
                </button>
                <button className={styles.option} onClick={() => signInWithGoogle("creator")}>
                  Creator
                </button>
              </div>

              <label className={styles.terms}>
                <input type="checkbox" required />
                <span>
                  I agree to the <a href="/terms" onClick={(e) => e.stopPropagation()}>Terms and Conditions</a> and <a href="/privacy" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>.
                </span>
              </label>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
