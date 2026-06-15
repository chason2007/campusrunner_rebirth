import { useState, useCallback, useRef } from "react";
import { useAuth } from "./context/AuthContext";
import { rupees, signOut } from "./lib/api";
import Login from "./screens/Login";
import BuyerApp from "./screens/BuyerApp";
import RunnerApp from "./screens/RunnerApp";
import { Toast } from "./components/UI";

export default function App() {
  const { session, profile, loading } = useAuth();
  const [mode, setMode] = useState("buy");
  const [toastMsg, setToastMsg] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const timer = useRef();

  const toast = useCallback((m) => {
    setToastMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(""), 2200);
  }, []);

  if (loading) {
    return <div className="phone items-center justify-center" style={{ display: "flex", color: "var(--muted)" }}>Loading…</div>;
  }
  if (!session) return <Login />;

  const isRun = mode === "run";

  return (
    <div className="phone">
      {/* brand + wallet + mode switch */}
      <div className="px-4 pt-3.5 pb-3 sticky top-0 z-[41]" style={{ background: "var(--ink)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Campus Runner Logo" className="w-[30px] h-[30px] object-cover rounded-lg" />
            <div><b className="font-black text-[16px] text-paper tracking-tight">Campus Runner</b></div>
          </div>
          <div className="relative">
            <button className="font-mono text-[12.5px] font-semibold px-2.5 py-1.5 rounded-full flex items-center gap-1.5 border-0 cursor-pointer"
                    style={{ background: "var(--amber-tint)", color: "var(--amber)" }}
                    onClick={() => setMenuOpen((o) => !o)}>
              ◎ {rupees(profile?.wallet_paise || 0)} <span className="text-[9px] opacity-70">▼</span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-[44]" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-[200px] rounded-xl p-1.5 z-[45]"
                     style={{ background: "var(--card)", border: "1.5px solid var(--line)", boxShadow: "0 8px 24px rgba(22,20,15,.18)" }}>
                  <div className="px-3 py-2.5 border-b" style={{ borderColor: "var(--line)" }}>
                    <b className="text-[14px] block text-ink">{profile?.full_name || "Student"}</b>
                    <small className="text-[11.5px]" style={{ color: "var(--muted)" }}>{session.user.email}</small>
                  </div>
                  <button className="w-full text-left px-3 py-2.5 rounded-lg text-[13.5px] font-bold cursor-pointer border-0 bg-transparent mt-1"
                          style={{ color: "var(--red)" }}
                          onClick={async () => { setMenuOpen(false); await signOut(); }}>
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex rounded-[11px] p-[3px] gap-[3px] w-full" style={{ background: "rgba(255,255,255,.08)" }}>
          <button className="flex-1 border-0 font-extrabold text-[13px] py-2.5 rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
                  style={{ background: !isRun ? "var(--amber)" : "transparent", color: !isRun ? "var(--ink)" : "var(--paper-dim)" }}
                  onClick={() => setMode("buy")}>🛒 I'm buying</button>
          <button className="flex-1 border-0 font-extrabold text-[13px] py-2.5 rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
                  style={{ background: isRun ? "var(--green)" : "transparent", color: isRun ? "#fff" : "var(--paper-dim)" }}
                  onClick={() => setMode("run")}>🏃 I'm running</button>
        </div>
      </div>

      {isRun ? <RunnerApp toast={toast} /> : <BuyerApp toast={toast} />}
      <Toast msg={toastMsg} />
    </div>
  );
}
