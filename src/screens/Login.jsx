import { useState } from "react";
import { signIn, signUp } from "../lib/api";

export default function Login() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(""); setInfo(""); setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await signUp(email.trim(), password, name.trim());
        if (error) throw error;
        // If email confirmation is ON in Supabase, there's no session yet.
        setInfo("Account created. If asked, confirm via the email link, then sign in.");
        setMode("signin");
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
        // AuthProvider picks up the session via onAuthStateChange
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";
  return (
    <div className="phone" style={{ display: "flex" }}>
      <div className="flex-1 flex flex-col justify-center px-7">
        <div className="mb-8">
          <img src="/logo.png" alt="Campus Runner Logo" className="w-12 h-12 object-cover rounded-xl mb-4" />
          <h1 className="big text-[30px]">Campus Runner</h1>
          <p className="sub mt-1">Get it. Go. {isSignup ? "Create your account." : "Sign in to continue."}</p>
        </div>

        {isSignup && (
          <div className="field mb-3.5">
            <label>Your name</label>
            <input placeholder="Aarav" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        <div className="field mb-3.5">
          <label>Email</label>
          <input inputMode="email" autoComplete="email" placeholder="you@college.edu"
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="field">
          <label>Password</label>
          <input type="password" autoComplete={isSignup ? "new-password" : "current-password"}
                 placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          {password.length > 0 && password.length < 6 && (
            <p className="text-[12px] font-semibold mt-1.5" style={{ color: "var(--red)" }}>Password must be at least 6 characters</p>
          )}
        </div>

        <button className="btn btn-primary mt-4"
                disabled={busy || !email || password.length < 6 || (isSignup && !name)}
                onClick={submit}>
          {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </button>

        <button className="btn btn-ghost mt-2"
                onClick={() => { setErr(""); setInfo(""); setMode(isSignup ? "signin" : "signup"); }}>
          {isSignup ? "I already have an account" : "New here? Create an account"}
        </button>

        {info && <p className="text-[13px] font-semibold mt-3" style={{ color: "var(--green)" }}>{info}</p>}
        {err && <p className="text-[13px] font-semibold mt-3" style={{ color: "var(--red)" }}>{err}</p>}
      </div>
    </div>
  );
}
