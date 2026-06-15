import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getProfile } from "../lib/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem("session_token");
    if (!token) {
      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const prof = await getProfile();
      if (prof) {
        setProfile(prof);
        setSession({ user: { id: prof.id, email: prof.email } });
      } else {
        localStorage.removeItem("session_token");
        setSession(null);
        setProfile(null);
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
      // Keep loading as false, but don't clear state on intermittent network errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();

    window.addEventListener("auth-changed", refreshProfile);
    return () => window.removeEventListener("auth-changed", refreshProfile);
  }, [refreshProfile]);

  return (
    <AuthCtx.Provider value={{ session, profile, loading, refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}
