import { useAuth } from "../lib/AuthContext";
import styles from "./SignIn.module.css";

export default function SignIn() {
  const { signInWithGoogle } = useAuth();

  return (
    <main className={styles.page}>
      <section className={styles.auth}>
        <div className={styles.authInner}>
          <a href="/" className={styles.logo} aria-label="UGC Hub home"><span>UGC</span><b>Hub</b></a>

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
          </div>

          <div className={styles.choice}>
            <button className={styles.option} onClick={() => signInWithGoogle("founder")}>
              Continue as Founder
            </button>
            <button className={styles.option} onClick={() => signInWithGoogle("creator")}>
              Continue as Creator
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
