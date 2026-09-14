import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/AuthContext";
import styles from "./Onboarding.module.css";

export default function FounderOnboarding({ onDone }) {
  const { user, refreshProfile } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Company or product name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("founders").insert({
      user_id: user.id,
      company_name: companyName.trim(),
      website_url: website.trim() || null,
      contact_email: user.email,
    });

    if (insertError) {
      setError("Something went wrong saving your profile. Please try again.");
      setSaving(false);
      return;
    }

    await supabase
      .from("user_profiles")
      .update({ onboarding_complete: true })
      .eq("id", user.id);

    await refreshProfile();
    setSaving(false);
    onDone?.();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.tag}>For founders</span>
        <h1>Quick setup</h1>
        <p className={styles.sub}>
          Just enough to post your first request. You can add more later.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            Company or product name
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Lyfta"
              required
            />
          </label>

          <label>
            Website <span className={styles.optional}>(optional)</span>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
              type="url"
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submit} disabled={saving}>
            {saving ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
