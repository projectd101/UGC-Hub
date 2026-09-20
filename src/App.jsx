import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { supabase } from "./supabaseClient";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import FounderOnboarding from "./pages/FounderOnboarding";
import CreatorOnboarding from "./pages/CreatorOnboarding";
import FounderDashboard from "./pages/FounderDashboard";
import CreatorDashboard from "./pages/CreatorDashboard";
import PaymentPending from "./pages/PaymentPending";
import CreatorProfile from "./pages/CreatorProfile";
import ProfileShell from "./pages/ProfileShell";

// The app has no router library; it switches on window.location.pathname.
// navigate() updates the URL with pushState (so refresh, deep links, and the
// browser back/forward buttons all work) and notifies listeners to re-render.
export function navigate(to) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function usePathname() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);
  return path;
}

function Router() {
  const { session, profile, loadingProfile, refreshProfile } = useAuth();

  const path = usePathname();
  const params = new URLSearchParams(window.location.search);
  const wantsSignIn = path === "/sign-in" || params.get("signin");

  // Not logged in: show landing, or sign-in screen if they clicked through.
  if (session === undefined) {
    return null; // brief auth-check flash, avoid rendering the wrong screen
  }

  if (!session) {
    return wantsSignIn ? <SignIn /> : <Landing />;
  }

  // Logged in but we haven't loaded their role/profile row yet.
  if (loadingProfile || profile === null) {
    return <CenteredMessage text="Loading your account…" />;
  }

  // Role not chosen yet (shouldn't normally happen — role is set right
  // after OAuth redirect — but handle it defensively).
  if (!profile.role) {
    return <CenteredMessage text="Setting up your account…" />;
  }

  // Dodo's return_url brings the user back to one of these paths after
  // checkout. The redirect is a full page load (fresh mount), so this is
  // the only reliable place to catch it — component-local state from
  // before the redirect is gone. We never trust the redirect's own status;
  // we only trust our own tables, populated by the verified webhook.
  if (path === "/creator/subscribed" && profile.role === "creator") {
    return (
      <SubscriptionConfirmationGate
        userId={profile.id}
        onConfirmed={async () => {
          await supabase.from("user_profiles").update({ onboarding_complete: true }).eq("id", profile.id);
          await refreshProfile();
          window.history.replaceState({}, "", "/");
        }}
      />
    );
  }

  if (path === "/founder/purchased" && profile.role === "founder") {
    const bundleId = params.get("bundle_id");
    return (
      <PurchaseConfirmationGate
        userId={profile.id}
        bundleId={bundleId}
        onDone={() => { window.location.href = "/"; }}
      />
    );
  }

  if (!profile.onboarding_complete) {
    return profile.role === "founder" ? (
      <FounderOnboarding onDone={() => window.location.reload()} />
    ) : (
      <CreatorOnboarding />
    );
  }

  if (profile.role === "founder") {
    const match = path.match(/^\/creator\/([0-9a-fA-F-]{36})\/?$/);
    if (match) {
      return (
        <CreatorProfileRoute
          creatorId={match[1]}
          onBack={() => navigate("/")}
        />
      );
    }
    return <FounderDashboard onOpenCreator={(id) => navigate(`/creator/${id}`)} />;
  }

  return <CreatorDashboard />;
}

// Looks up this user's creator_id (not always present on `profile` directly)
// before handing off to PaymentPending, since the poll needs it.
function SubscriptionConfirmationGate({ userId, onConfirmed }) {
  const [creatorId, setCreatorId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("creators")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setCreatorId(data?.id || null);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) return <CenteredMessage text="Loading…" />;
  if (!creatorId) return <CenteredMessage text="We couldn't find your creator profile." />;

  return <PaymentPending kind="subscription" creatorId={creatorId} onConfirmed={onConfirmed} onTimeout={onConfirmed} />;
}

// Same idea for founders returning from a bundle purchase: look up their
// founder_id before handing off to PaymentPending.
function PurchaseConfirmationGate({ userId, bundleId, onDone }) {
  const [founderId, setFounderId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("founders")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setFounderId(data?.id || null);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) return <CenteredMessage text="Loading…" />;
  if (!founderId || !bundleId) return <CenteredMessage text="Something went wrong loading your purchase." />;

  return <PaymentPending kind="bundle" founderId={founderId} bundleId={bundleId} onConfirmed={onDone} onTimeout={onDone} />;
}

// Shell for the profile page: same header/brand as the dashboards so it feels
// like part of the app rather than a separate site.
function CreatorProfileRoute({ creatorId, onBack }) {
  const { signOut } = useAuth();
  return (
    <ProfileShell onSignOut={signOut}>
      <CreatorProfile creatorId={creatorId} onBack={onBack} onOpenBundle={(bundleId) => navigate(`/?bundle=${bundleId}`)} />
    </ProfileShell>
  );
}

function CenteredMessage({ text }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--ink-dim)",
        fontSize: 14.5,
      }}
    >
      {text}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}