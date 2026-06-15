import { useState } from "react";
import { sendOtp, verifyOtp } from "../lib/api";

export default function Login() {
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSend() {
    setErr(""); setBusy(true);
    // Supabase expects E.164 (+countrycode). Default to India.
    const full = phone.startsWith("+") ? phone : "+91" + phone.replace(/\D/g, "");
    const { error } = await sendOtp(full);
    setBusy(false);
    if (error) return setErr(error.message);
    setPhone(full);
    setStep("otp");
  }
  async function handleVerify() {
    setErr(""); setBusy(true);
    const { error } = await verifyOtp(phone, otp);
    setBusy(false);
    if (error) return setErr(error.message);
    // AuthProvider picks up the session via onAuthStateChange
  }

  return (
    <div className="phone items-stretch justify-center" style={{ display: "flex" }}>
      <div className="flex-1 flex flex-col justify-center px-7">
        <div className="mb-8">
          <div className="inline-grid place-items-center w-12 h-12 rounded-xl font-black text-2xl text-ink mb-4"
               style={{ background: "var(--amber)", transform: "rotate(-6deg)" }}>R</div>
          <h1 className="big text-[30px]">Campus Runner</h1>
          <p className="sub mt-1">Get it. Go. Sign in with your phone.</p>
        </div>

        {step === "phone" ? (
          <div className="field">
            <label>Phone number</label>
            <input inputMode="tel" placeholder="98765 43210" value={phone}
                   onChange={(e) => setPhone(e.target.value)} />
            <button className="btn btn-primary mt-4" disabled={busy || phone.length < 10}
                    onClick={handleSend}>{busy ? "Sending…" : "Send code"}</button>
          </div>
        ) : (
          <div className="field">
            <label>Enter the 6-digit code sent to {phone}</label>
            <input inputMode="numeric" placeholder="••••••" value={otp}
                   onChange={(e) => setOtp(e.target.value)} />
            <button className="btn btn-primary mt-4" disabled={busy || otp.length < 6}
                    onClick={handleVerify}>{busy ? "Verifying…" : "Verify & continue"}</button>
            <button className="btn btn-ghost mt-2" onClick={() => setStep("phone")}>Change number</button>
          </div>
        )}
        {err && <p className="text-[13px] font-semibold mt-3" style={{ color: "var(--red)" }}>{err}</p>}
      </div>
    </div>
  );
}
