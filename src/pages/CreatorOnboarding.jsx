import { useEffect, useState } from "react";
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

const PLAN_PRICE_CENTS = 1900; // $19/mo flat

export default function CreatorOnboarding() {
  const { user } = useAuth();
  const [step, setStep] = useState("checking"); // "checking" | "profile" | "plan" | "pending"
  const [creatorId, setCreatorId] = useState(null);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [contactHandle, setContactHandle] = useState("");
  const [reactions, setReactions] = useState([]);
  const [niches, setNiches] = useState([]);
  const [sampleUrls, setSampleUrls] = useState(["", "", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // A creator row may already exist from a previous, incomplete onboarding
  // attempt (e.g. the person's session dropped after the profile step but
  // before they finished checkout). Resume from "plan" in that case instead
  // of re-showing the profile form, which would hit the creators_user_id
  // unique constraint on resubmit.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("creators")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.id) {
          setCreatorId(data.id);
          setStep("plan");
        } else {
          setStep("profile");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

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

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      setError("Your session expired. Please sign in again.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dodo-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ kind: "subscription" }),
        }
      );
      const body = await res.json();

      if (!res.ok || !body.checkout_url) {
        setError(body.error || "Couldn't start checkout. Please try again.");
        setSaving(false);
        return;
      }

      // Redirect to Dodo's hosted checkout. We do NOT mark onboarding
      // complete here — that only happens once the webhook confirms the
      // subscription is active. Dodo's return_url brings the user back to
      // /creator/subscribed, which App.jsx routes to a fresh PaymentPending
      // screen (this component will have fully remounted by then).
      window.location.href = body.checkout_url;
    } catch {
      setError("Couldn't reach the payment service. Please try again.");
      setSaving(false);
    }
  }



  if (step === "checking") {
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <p className={styles.sub}>Loading…</p>
        </div>
      </div>
    );
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