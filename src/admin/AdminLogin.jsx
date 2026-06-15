import { useState } from "react";
import { signIn } from "../lib/api";

export default function AdminLogin() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState("");
  const [busy, setBusy]         = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) throw error;
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--amber)", color: "#000", fontWeight: 900, fontSize: 18, display: "grid", placeItems: "center", transform: "rotate(-6deg)", flexShrink: 0 }}>R</div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, marginBottom: 1 }}>Campus Runner</h1>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Admin dashboard</p>
          </div>
        </div>

        <div className="field">
          <label>Email</label>
          <input type="email" autoComplete="email" placeholder="admin@college.edu"
                 value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Password</label>
          <input type="password" autoComplete="current-password" placeholder="••••••••"
                 value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        {err && <p className="err">{err}</p>}

        <button className="btn btn-primary" style={{ width: "100%", marginTop: 20, justifyContent: "center" }}
                disabled={busy || !email || password.length < 6}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
