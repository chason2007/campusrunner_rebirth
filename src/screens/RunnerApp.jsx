import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { RUNNER_NEXT } from "../lib/constants";
import {
  getOpenFeed, getMyRuns, acceptOrder, advanceOrder, setItemCollected,
  subscribeOrders, rupees,
} from "../lib/api";
import { Empty } from "../components/UI";

export default function RunnerApp({ toast }) {
  const { session, profile, refreshProfile } = useAuth();
  const uid = session.user.id;
  const [rTab, setRTab] = useState("feed");
  const [online, setOnline] = useState(true);
  const [feed, setFeed] = useState([]);
  const [runs, setRuns] = useState([]);

  const load = () => { getOpenFeed().then(setFeed); getMyRuns(uid).then(setRuns); };
  useEffect(() => { load(); const off = subscribeOrders(load); return off; }, [uid]);

  const activeRuns = runs.filter((r) => r.status !== "COMPLETED");
  const doneRuns = runs.filter((r) => r.status === "COMPLETED");
  const earnedPaise = doneRuns.reduce((s, r) => s + r.runner_fee_paise + r.surge_fee_paise, 0);

  async function accept(id) {
    try { await acceptOrder(id); load(); toast("✅ Accepted — head to the shop"); setRTab("active"); }
    catch (e) { toast("⚠️ " + e.message); load(); }
  }
  async function advance(r, to) {
    try { await advanceOrder(r.id, to); load(); if (to === "DELIVERED") toast("📦 Delivered — buyer will confirm"); }
    catch (e) { toast("⚠️ " + e.message); }
  }
  async function toggle(item) {
    try { await setItemCollected(item.id, !item.is_collected); load(); }
    catch (e) { toast("⚠️ " + e.message); }
  }

  return (
    <>
      <div className="screen">
        {rTab === "feed" && (
          <>
            <div className="mx-4 mt-4 card flex items-center justify-between">
              <div><b className="text-[15px] font-extrabold">{online ? "🟢 You're online" : "You're offline"}</b>
                <small className="text-[11.5px] block mt-0.5" style={{ color: "var(--muted)" }}>{online ? "Showing tasks near you" : "Go online to see open tasks"}</small></div>
              <div className={`switch ${online ? "on" : ""}`} onClick={() => setOnline(!online)} />
            </div>
            {!online ? <Empty emo="😴" title="Offline" sub="Flip the switch to start picking up runs." />
              : <>
                  <div className="px-4 pt-1 pb-1"><div className="eyebrow">Open near you</div><h1 className="big text-[23px]">Pick up a run</h1></div>
                  {feed.length === 0 ? <Empty emo="⚡" title="All clear" sub="No open tasks right now." />
                    : feed.map((f) => <FeedCard key={f.id} f={f} onAccept={() => accept(f.id)} />)}
                </>}
          </>
        )}

        {rTab === "active" && (
          activeRuns.length === 0 ? <><div className="px-4 pt-4"><div className="eyebrow">Running</div></div><Empty emo="🏃" title="Nothing active" sub="Accept a task from Open to start." /></>
          : <>
              <div className="px-4 pt-4 pb-1"><div className="eyebrow">Active run</div><h1 className="big text-[23px]">On the move</h1></div>
              {activeRuns.map((r) => <ActiveCard key={r.id} r={r} onToggle={toggle} onAdvance={advance} />)}
            </>
        )}

        {rTab === "earn" && (
          <>
            <div className="px-4 pt-4 pb-1"><div className="eyebrow">Today</div><h1 className="big">{rupees(earnedPaise)}</h1><div className="sub mb-4">Across {doneRuns.length} run{doneRuns.length === 1 ? "" : "s"}.</div></div>
            <div className="grid grid-cols-3 gap-2.5 mx-4 mb-3.5">
              <Stat b={doneRuns.length} s="Runs" />
              <Stat b={rupees(earnedPaise)} s="Earned" color="var(--green)" />
              <Stat b={rupees(doneRuns.length ? earnedPaise / doneRuns.length : 0)} s="Avg/run" />
            </div>
            <div className="mx-4 mb-3.5 rounded-2xl p-4" style={{ background: "var(--ink)", color: "var(--paper)" }}>
              <Line label="Wallet balance" val={rupees(profile?.wallet_paise || 0)} />
              <div className="flex justify-between pt-2.5 mt-1.5 font-black text-[18px]" style={{ borderTop: "1px dashed rgba(246,243,234,.2)", fontFamily: "'Archivo Black'" }}><span>Cash out</span><span style={{ fontFamily: "'Spline Sans Mono'" }}>{rupees(earnedPaise)}</span></div>
            </div>
            <div className="px-4"><button className="btn btn-dark" onClick={() => toast("💸 Payout to UPI requested")}>Cash out to UPI</button></div>
            {doneRuns.length > 0 && <>
              <div className="flex items-baseline justify-between px-4 pt-5 pb-2.5"><h3 className="font-black text-[15px]">Completed runs</h3></div>
              {doneRuns.map((r) => (
                <div key={r.id} className="card mx-4 mb-2.5 !py-3 flex items-center gap-2.5">
                  <div className="flex-1"><b className="text-[14px] font-extrabold">{r.vendor?.name || "Custom"}</b><div className="sub mt-0.5 text-[11px]">{r.drop_location}</div></div>
                  <b className="font-black text-[16px]" style={{ color: "var(--green)" }}>+{rupees(r.runner_fee_paise + r.surge_fee_paise)}</b>
                </div>
              ))}
            </>}
          </>
        )}
      </div>

      <RunnerNav rTab={rTab} setRTab={setRTab} activeCount={activeRuns.length} />
    </>
  );
}

function FeedCard({ f, onAccept }) {
  const items = f.order_items || [];
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  return (
    <div className="card mx-4 mb-3">
      <div className="flex items-start gap-2.5 mb-3">
        <div className="flex-1 min-w-0"><b className="text-[16px] font-extrabold">{f.vendor?.name || (f.is_custom ? "Custom request" : "Order")}</b>
          <div className="sub mt-0.5 text-[11.5px]" style={{ fontFamily: "'Spline Sans Mono'" }}>📍 {f.drop_location}</div></div>
        <div className="text-right flex-none"><b className="font-black text-[20px]" style={{ color: "var(--green)" }}>{rupees(f.runner_fee_paise + f.surge_fee_paise)}</b>
          <div className="text-[9.5px] uppercase font-bold" style={{ color: "var(--muted)" }}>you earn</div></div>
      </div>
      <div className="rounded-[11px] p-3 mb-3" style={{ background: "var(--paper)" }}>
        {items.map((it) => <div key={it.id} className="flex gap-2 text-[13px] font-semibold py-0.5"><span>{it.emoji}</span><span className="flex-1">{it.name}</span><span style={{ fontFamily: "'Spline Sans Mono'", color: "var(--muted)" }}>×{it.quantity}</span></div>)}
      </div>
      <div className="flex gap-1.5 mb-3"><span className="text-[10.5px] font-bold px-2.5 py-1 rounded-md" style={{ background: "var(--paper)", color: "#5a5648" }}>{itemCount} items · ~{rupees(f.items_subtotal_paise)}</span></div>
      <button className="btn btn-run" onClick={onAccept}>Accept run</button>
    </div>
  );
}

function ActiveCard({ r, onToggle, onAdvance }) {
  const items = r.order_items || [];
  const allChecked = items.length > 0 && items.every((i) => i.is_collected);
  const isShopping = r.status === "SHOPPING";
  const nxt = RUNNER_NEXT[r.status];
  return (
    <div className="card mx-4 mb-3.5">
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="flex-1"><b className="text-[16px] font-extrabold">{r.vendor?.name || "Custom request"}</b>
          <div className="sub mt-0.5 text-[11.5px]" style={{ fontFamily: "'Spline Sans Mono'" }}>📍 {r.drop_location} · earn {rupees(r.runner_fee_paise + r.surge_fee_paise)}</div></div>
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full uppercase" style={{ background: "var(--amber)", color: "var(--ink)" }}>{r.status}</span>
      </div>

      {isShopping ? (
        <>
          <div className="eyebrow mt-3.5 mb-1">Tick items as you grab them</div>
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 py-3 border-b last:border-0 cursor-pointer" style={{ borderColor: "var(--line)" }} onClick={() => onToggle(it)}>
              <div className="w-[26px] h-[26px] rounded-lg grid place-items-center text-sm flex-none" style={{ border: "2px solid " + (it.is_collected ? "var(--green)" : "var(--line)"), background: it.is_collected ? "var(--green)" : "transparent", color: "#fff" }}>{it.is_collected ? "✓" : ""}</div>
              <div className="w-[42px] h-[42px] rounded-[10px] grid place-items-center text-[21px] flex-none" style={{ background: "var(--paper)" }}>{it.emoji}</div>
              <div className="flex-1"><div className="text-[14px] font-extrabold" style={{ textDecoration: it.is_collected ? "line-through" : "none", color: it.is_collected ? "var(--muted)" : "var(--ink)" }}>{it.name}</div><div className="text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>{rupees(it.unit_price_paise)} each</div></div>
              <div className="font-black text-[14px] flex-none">×{it.quantity}</div>
            </div>
          ))}
          <div className="rounded-[11px] p-3 mt-3 flex justify-between font-extrabold text-[14px]" style={{ background: "var(--paper)" }}><span>Bill to pay at counter</span><span style={{ fontFamily: "'Spline Sans Mono'" }}>{rupees(r.items_subtotal_paise)}</span></div>
        </>
      ) : (
        <div className="rounded-[11px] p-3 my-2.5" style={{ background: "var(--paper)" }}>
          {items.map((it) => <div key={it.id} className="flex gap-2 text-[13px] font-semibold py-0.5"><span>{it.emoji}</span><span className="flex-1">{it.name}</span><span style={{ fontFamily: "'Spline Sans Mono'", color: "var(--muted)" }}>×{it.quantity}</span></div>)}
        </div>
      )}

      {nxt && (
        <button className="btn mt-3" disabled={isShopping && !allChecked}
                style={{ background: isShopping && !allChecked ? "var(--line)" : "var(--green)", color: isShopping && !allChecked ? "var(--muted)" : "#fff" }}
                onClick={() => onAdvance(r, nxt[0])}>{isShopping && !allChecked ? "Tick all items first" : nxt[1]}</button>
      )}
      {r.status === "DELIVERED" && <div className="text-center text-[12.5px] font-semibold mt-3" style={{ color: "var(--muted)" }}>Waiting for buyer to confirm receipt…</div>}
    </div>
  );
}

function Stat({ b, s, color }) {
  return <div className="card !p-3.5 text-center"><b className="font-black text-[20px] block" style={{ color: color || "var(--ink)" }}>{b}</b><small className="text-[10px] font-bold uppercase" style={{ color: "var(--muted)" }}>{s}</small></div>;
}
function Line({ label, val }) {
  return <div className="flex justify-between text-[13px] py-1 font-medium" style={{ color: "rgba(246,243,234,.7)" }}><span>{label}</span><span style={{ fontFamily: "'Spline Sans Mono'" }}>{val}</span></div>;
}

function RunnerNav({ rTab, setRTab, activeCount }) {
  const items = [["feed", "⚡", "Open"], ["active", "🏃", "Running", activeCount], ["earn", "💰", "Earnings"]];
  return (
    <div className="absolute bottom-0 left-0 right-0 flex px-1.5 pt-2 pb-2 z-30" style={{ background: "var(--card)", borderTop: "1.5px solid var(--line)" }}>
      {items.map(([t, i, l, badge]) => {
        const on = rTab === t;
        return <button key={t} className="flex-1 border-0 bg-transparent flex flex-col items-center gap-0.5 cursor-pointer py-1.5 relative" style={{ color: on ? "var(--ink)" : "var(--muted)" }} onClick={() => setRTab(t)}>
          {badge > 0 && <span className="absolute top-0 text-[9px] font-extrabold text-white rounded-lg px-1" style={{ background: "var(--red)", right: "calc(50% - 22px)", minWidth: 16, height: 16, display: "grid", placeItems: "center" }}>{badge}</span>}
          <span className="text-[20px] leading-none">{i}</span><span className="text-[10px] font-bold">{l}</span></button>;
      })}
    </div>
  );
}
