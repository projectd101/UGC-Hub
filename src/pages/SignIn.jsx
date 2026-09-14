import { useAuth } from "../lib/AuthContext";
import styles from "./SignIn.module.css";

export default function SignIn() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className={styles.wrap}>
      <a href="/" className={styles.logo}>
        UGC Hub
      </a>

      <div className={styles.cards}>
        <button
          className={`${styles.card} ${styles.founder}`}
          onClick={() => signInWithGoogle("founder")}
        >
          <span className={styles.tag}>For founders</span>
          <h2>Find a creator</h2>
          <p>Post what you need. Browse profiles. Message creators directly.</p>
          <span className={styles.google}>Continue with Google</span>
        </button>

        <button
          className={`${styles.card} ${styles.creator}`}
          onClick={() => signInWithGoogle("creator")}
        >
          <span className={styles.tag}>For creators</span>
          <h2>Get discovered</h2>
          <p>Build a profile. See what founders are looking for. Get paid direct.</p>
          <span className={styles.google}>Continue with Google</span>
        </button>
      </div>

      <p className={styles.fine}>
        Choosing an account type is permanent for this account. Use a
        separate Google account if you need both.
      </p>
    </div>
  );
}
