import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// Shown right after a Dodo checkout redirect. The checkout return_url status
// is NOT authoritative (Dodo's own guidance) — the only thing that actually
// grants access is the verified webhook writing to our DB. So this screen
// just polls our own tables for a few seconds until that row shows up.
//
// kind: "subscription" -> polls `subscriptions` for this creator, active status
// kind: "bundle"        -> polls `bundle_purchases` for this founder+bundle

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 20; // ~30s, generous for webhook delivery lag

export default function PaymentPending({ kind, creatorId, founderId, bundleId, onConfirmed, onTimeout }) {
  const [attempt, setAttempt] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (kind === "subscription") {
        const { data } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("creator_id", creatorId)
          .eq("status", "active")
          .maybeSingle();
        if (data && !cancelled) return onConfirmed?.();
      } else if (kind === "bundle") {
        const { data } = await supabase
          .from("bundle_purchases")
          .select("id")
          .eq("founder_id", founderId)
          .eq("bundle_id", bundleId)
          .maybeSingle();
        if (data && !cancelled) return onConfirmed?.();
      }

      if (cancelled) return;

      if (attempt >= MAX_POLLS) {
        setTimedOut(true);
        onTimeout?.();
        return;
      }

      setTimeout(() => {
        if (!cancelled) setAttempt((a) => a + 1);
      }, POLL_INTERVAL_MS);
    }

    poll();
    return () => { cancelled = true; };
  }, [attempt, kind, creatorId, founderId, bundleId, onConfirmed, onTimeout]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24, textAlign: "center" }}>
      {!timedOut ? (
        <>
          <div style={{ width: 32, height: 32, border: "3px solid #e5e5ea", borderTopColor: "#6b5bff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "#666", fontSize: 14.5, maxWidth: 360 }}>
            Confirming your payment… this usually takes a few seconds.
          </p>
          <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
        </>
      ) : (
        <>
          <p style={{ color: "#666", fontSize: 14.5, maxWidth: 360 }}>
            We're still waiting on confirmation from the payment provider. If you completed payment, this page will update automatically once it's confirmed — you can also refresh in a minute.
          </p>
        </>
      )}
    </div>
  );
}
