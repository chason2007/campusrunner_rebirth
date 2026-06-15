import { useEffect, useState, useCallback } from "react";
import { getProfile, signOut } from "../lib/api";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";

export default function AdminRoot() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);

  const syncState = useCallback(async () => {
    const token = localStorage.getItem("session_token");
    if (!token) {
      setSession(null);
      setProfile(null);
      return;
    }
    const prof = await getProfile();
    if (prof) {
      setProfile(prof);
      setSession({ user: { id: prof.id, email: prof.email } });
    } else {
      setSession(null);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    syncState().then(() => {
      setSession(prev => prev === undefined ? null : prev);
    });

    window.addEventListener("auth-changed", syncState);
    return () => window.removeEventListener("auth-changed", syncState);
  }, [syncState]);

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
        <button className="btn btn-ghost btn-sm" onClick={() => signOut()}>Sign out</button>
      </div>
    );
  }

  if (!profile) return null;

  return <AdminDashboard profile={profile} onSignOut={() => signOut()} />;
}
