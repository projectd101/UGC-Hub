import styles from "./Dashboard.module.css";

// Minimal page chrome for founder-facing detail pages (e.g. a creator profile).
// Reuses the dashboard header/brand classes so it reads as part of the same app.
export default function ProfileShell({ children, onSignOut }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.appArea} style={{ marginLeft: 0 }}>
        <header className={styles.header}>
          <a href="/" className={`${styles.logo} ugcBrandMark`} aria-label="UGC Hub home">
            <span className="ugcBrandMark__ugc">UGC</span>
            <span className="ugcBrandMark__hub">Hub</span>
          </a>
          <div className={styles.headerActions}>
            <button className={styles.signOut} onClick={onSignOut}>Sign out</button>
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
