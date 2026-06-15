import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getProfile } from "../lib/api";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";

export default function AdminRoot() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) getProfile(data.session.user.id).then(setProfile);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) getProfile(s.user.id).then(setProfile);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  if (!session) return <AdminLogin />;

  if (profile && !profile.is_admin) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ fontSize: 32 }}>🚫</div>
        <p style={{ color: "var(--muted)", fontWeight: 600 }}>Access denied — not an admin account.</p>
        <button className="btn btn-ghost btn-sm" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    );
  }

  if (!profile) return null;

  return <AdminDashboard profile={profile} onSignOut={() => supabase.auth.signOut()} />;
}
