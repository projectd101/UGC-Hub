import { AuthProvider, useAuth } from "./lib/AuthContext";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import FounderOnboarding from "./pages/FounderOnboarding";
import CreatorOnboarding from "./pages/CreatorOnboarding";
import FounderDashboard from "./pages/FounderDashboard";
import CreatorDashboard from "./pages/CreatorDashboard";

function Router() {
  const { session, profile, loadingProfile } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const wantsSignIn = window.location.pathname === "/sign-in" || params.get("signin");

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

  if (!profile.onboarding_complete) {
    return profile.role === "founder" ? (
      <FounderOnboarding onDone={() => window.location.reload()} />
    ) : (
      <CreatorOnboarding onDone={() => window.location.reload()} />
    );
  }

  return profile.role === "founder" ? <FounderDashboard /> : <CreatorDashboard />;
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
