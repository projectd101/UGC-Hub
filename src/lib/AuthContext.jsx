import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);
const PRODUCTION_URL = "https://ugc-hub-theta.vercel.app";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null); // user_profiles row
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);

      // Supabase's implicit OAuth flow returns the session in the URL hash.
      // The client consumes it, so remove the credentials from the address bar.
      if (window.location.hash) {
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}${window.location.search}`
        );
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }

    async function loadAndMaybeAssignRole() {
      setLoadingProfile(true);
      let { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      // First login after OAuth redirect: role arrives as a query param
      // (?role=founder|creator) set when the person picked a signup path.
      // Lock it in once via RPC if the profile doesn't have a role yet.
      if (data && !data.role) {
        const params = new URLSearchParams(window.location.search);
        const pendingRole = params.get("role");
        if (pendingRole === "founder" || pendingRole === "creator") {
          const { data: updated } = await supabase.rpc("set_user_role", {
            p_role: pendingRole,
          });
          if (updated) data = updated;
          params.delete("role");
          const clean =
            window.location.pathname +
            (params.toString() ? `?${params}` : "") +
            window.location.hash;
          window.history.replaceState({}, "", clean);
        }
      }

      setProfile(data);
      setLoadingProfile(false);
    }

    loadAndMaybeAssignRole();
  }, [session?.user?.id]);

  async function signInWithGoogle(role) {
    // Always return to the real production app. Using window.location.origin
    // here was allowing the Supabase project's localhost Site URL/configuration
    // to send production OAuth callbacks to localhost.
    const redirectTo = `${PRODUCTION_URL}/?role=${role}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      console.error("Google OAuth error:", error);
      throw error;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loadingProfile,
        signInWithGoogle,
        signOut,
        refreshProfile: async () => {
          if (!session?.user) return;
          const { data } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();
          setProfile(data);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
