import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { getProfile } from "../lib/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async (uid) => {
    if (!uid) return setProfile(null);
    setProfile(await getProfile(uid));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      refreshProfile(data.session?.user?.id).finally(() => setLoading(false));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      refreshProfile(s?.user?.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshProfile]);

  return (
    <AuthCtx.Provider value={{ session, profile, loading, refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}
