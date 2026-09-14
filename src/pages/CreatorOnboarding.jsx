import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/AuthContext";
import styles from "./Onboarding.module.css";

const REACTION_OPTIONS = [
  "Shocked",
  "Excited",
  "Confused",
  "Happy",
  "Crying",
  "Frustrated",
  "Skeptical",
  "Relaxed",
];

const NICHE_OPTIONS = [
  "Fitness",
  "Fintech",
  "Dating",
  "AI tools",
  "Mobile games",
  "Health & wellness",
  "Productivity",
  "Social apps",
  "Ecommerce",
  "Education",
];

const PLAN_PRICE_CENTS = 1900; // $19/mo flat — dummy for now

export default function CreatorOnboarding({ onDone }) {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState("profile"); // "profile" | "plan"
  const [creatorId, setCreatorId] = useState(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [contactHandle, setContactHandle] = useState("");
  const [reactions, setReactions] = useState([]);
  const [niches, setNiches] = useState([]);
  const [sampleUrls, setSampleUrls] = useState(["", "", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function toggle(list, setList, value) {
    setList(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    );
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Your name (or the name you want shown) is required.");
      return;
    }
    if (reactions.length === 0) {
      setError("Pick at least one reaction you can film.");
      return;
    }
    setSaving(true);
    setError(null);

    const cleanSamples = sampleUrls.map((s) => s.trim()).filter(Boolean);

    const { data, error: insertError } = await supabase
      .from("creators")
      .insert({
        user_id: user.id,
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        contact_handle: contactHandle.trim() || null,
        reactions,
        niches,
        sample_urls: cleanSamples,
      })
      .select()
      .single();

    if (insertError) {
      setError("Something went wrong saving your profile. Please try again.");
      setSaving(false);
      return;
    }

    setCreatorId(data.id);
    setSaving(false);
    setStep("plan");
  }

  async function handleSubscribe() {
    setSaving(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc("fake_subscribe_creator", {
      p_creator_id: creatorId,
    });

    if (rpcError) {
      setError("Couldn't activate your plan. Please try again.");
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

  if (step === "plan") {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <span className={styles.tag} style={{ color: "var(--violet)" }}>
            One last step
          </span>
          <h1>Get seen by founders</h1>
          <p className={styles.sub}>
            A flat plan unlocks your visibility — founders can find your
            profile and send requests, and you can browse what they're
            looking for.
          </p>

          <div className={styles.plan}>
            <div>
              <strong>UGC Hub — Creator</strong>
              <p className={styles.planDetail}>
                Unlimited requests, full profile visibility
              </p>
            </div>
            <span className={styles.price}>
              ${(PLAN_PRICE_CENTS / 100).toFixed(0)}
              <span className={styles.priceUnit}>/mo</span>
            </span>
          </div>

          <p className={styles.dummyNote}>
            Payments aren't live yet — this activates your account without
            charging you.
          </p>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submit} onClick={handleSubscribe} disabled={saving}>
            {saving ? "Activating…" : "Activate plan"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={`${styles.card} ${styles.wide}`}>
        <span className={styles.tag} style={{ color: "var(--violet)" }}>
          For creators
        </span>
        <h1>Build your profile</h1>
        <p className={styles.sub}>
          This is what founders see. Be specific — it's how they decide to
          reach out.
        </p>

        <form onSubmit={handleProfileSubmit} className={styles.form}>
          <label>
            Display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How founders will see you"
              required
            />
          </label>

          <label>
            Bio <span className={styles.optional}>(optional)</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A line or two about you and your content style"
              rows={3}
            />
          </label>

          <label>
            Contact handle
            <input
              value={contactHandle}
              onChange={(e) => setContactHandle(e.target.value)}
              placeholder="@yourhandle or email — shown only after a founder unlocks you"
            />
          </label>

          <div className={styles.fieldGroup}>
            <span className={styles.groupLabel}>Reactions you can film</span>
            <div className={styles.chips}>
              {REACTION_OPTIONS.map((r) => (
                <button
                  type="button"
                  key={r}
                  className={`${styles.chip} ${
                    reactions.includes(r) ? styles.chipActive : ""
                  }`}
                  onClick={() => toggle(reactions, setReactions, r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.groupLabel}>
              Niches you fit <span className={styles.optional}>(optional)</span>
            </span>
            <div className={styles.chips}>
              {NICHE_OPTIONS.map((n) => (
                <button
                  type="button"
                  key={n}
                  className={`${styles.chip} ${
                    niches.includes(n) ? styles.chipActive : ""
                  }`}
                  onClick={() => toggle(niches, setNiches, n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.groupLabel}>
              Sample clip links <span className={styles.optional}>(optional)</span>
            </span>
            {sampleUrls.map((url, i) => (
              <input
                key={i}
                value={url}
                onChange={(e) => {
                  const next = [...sampleUrls];
                  next[i] = e.target.value;
                  setSampleUrls(next);
                }}
                placeholder={`Link to sample clip ${i + 1}`}
                type="url"
                style={{ marginBottom: 10 }}
              />
            ))}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submit} disabled={saving}>
            {saving ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
