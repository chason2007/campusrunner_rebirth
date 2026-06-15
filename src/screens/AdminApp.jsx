import { useCallback, useEffect, useState } from "react";
import {
  adminGetAllOrders, adminGetAllProfiles, adminGetVendors, adminGetProducts,
  adminSetVendorActive, adminSetProductAvailable, adminSetUserAdmin,
  adminDeleteVendor, adminDeleteProduct, adminDeleteProfile,
  rupees, subscribeOrders,
} from "../lib/api";
import { Empty } from "../components/UI";

const TABS = [
  ["orders", "📋", "Orders"],
  ["vendors", "🏪", "Vendors"],
  ["products", "📦", "Products"],
  ["users", "👥", "Users"],
];

const STATUS_COLORS = {
  PLACED:    ["var(--line)",       "#6a6555"],
  ACCEPTED:  ["#e3edff",          "#2655a0"],
  SHOPPING:  ["var(--amber)",     "var(--ink)"],
  PURCHASED: ["#ffe8b0",          "#7a4800"],
  DELIVERED: ["var(--green-soft)","#1f7a44"],
  COMPLETED: ["var(--green)",     "#fff"],
};

export default function AdminApp({ toast }) {
  const [tab, setTab] = useState("orders");
  const [orders, setOrders]   = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [vendors, setVendors]  = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");

  const loadOrders  = useCallback(() => adminGetAllOrders().then(setOrders), []);
  const loadVendors = useCallback(() => adminGetVendors().then(setVendors), []);
  const loadProducts = useCallback(() => adminGetProducts().then(setProducts), []);
  const loadUsers   = useCallback(() => adminGetAllProfiles().then(setProfiles), []);

  useEffect(() => { loadOrders(); const off = subscribeOrders(loadOrders); return off; }, [loadOrders]);
  useEffect(() => { loadVendors(); }, [loadVendors]);
  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const q = search.toLowerCase();

  const filteredOrders = orders.filter((o) =>
    !q || o.id.includes(q) || o.buyer?.full_name?.toLowerCase().includes(q) ||
    o.runner?.full_name?.toLowerCase().includes(q) || o.status.toLowerCase().includes(q)
  );
  const filteredVendors = vendors.filter((v) => !q || v.name.toLowerCase().includes(q));
  const filteredProducts = products.filter((p) =>
    !q || p.name.toLowerCase().includes(q) || p.vendor?.name?.toLowerCase().includes(q)
  );
  const filteredUsers = profiles.filter((u) =>
    !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  );

  // stats
  const totalRevenue = orders.filter((o) => o.status === "COMPLETED").reduce((s, o) => s + o.total_paise, 0);
  const active = orders.filter((o) => !["COMPLETED", "PLACED"].includes(o.status)).length;
  const pending = orders.filter((o) => o.status === "PLACED").length;

  async function toggleVendor(v) {
    try { await adminSetVendorActive(v.id, !v.is_active); loadVendors(); toast(v.is_active ? "Vendor paused" : "Vendor activated"); }
    catch (e) { toast("⚠️ " + e.message); }
  }
  async function toggleProduct(p) {
    try { await adminSetProductAvailable(p.id, !p.is_available); loadProducts(); toast(p.is_available ? "Product hidden" : "Product visible"); }
    catch (e) { toast("⚠️ " + e.message); }
  }
  async function toggleAdmin(u) {
    try { await adminSetUserAdmin(u.id, !u.is_admin); loadUsers(); toast(u.is_admin ? "Admin removed" : "Made admin"); }
    catch (e) { toast("⚠️ " + e.message); }
  }
  async function deleteVendor(v) {
    if (!confirm(`Are you sure you want to delete vendor "${v.name}"? This will also cascade delete all their products.`)) return;
    try { await adminDeleteVendor(v.id); loadVendors(); toast("Vendor deleted"); }
    catch (e) { toast("⚠️ " + e.message); }
  }
  async function deleteProduct(p) {
    if (!confirm(`Are you sure you want to delete product "${p.name}"?`)) return;
    try { await adminDeleteProduct(p.id); loadProducts(); toast("Product deleted"); }
    catch (e) { toast("⚠️ " + e.message); }
  }
  async function deleteUser(u) {
    if (!confirm(`Are you sure you want to delete user "${u.full_name || u.email}"?`)) return;
    try { await adminDeleteProfile(u.id); loadUsers(); toast("User deleted"); }
    catch (e) { toast("⚠️ " + e.message); }
  }

  return (
    <div className="screen">
      {/* header */}
      <div className="px-4 pt-4 pb-3 sticky top-0 z-40" style={{ background: "var(--paper)", borderBottom: "1.5px solid var(--line)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="eyebrow">Superadmin</div>
            <h1 className="big text-[22px]">Dashboard</h1>
          </div>
          <div className="flex gap-3">
            <Pill color="var(--amber)" label={`${pending} pending`} />
            <Pill color="var(--green)" label={`${active} active`} />
          </div>
        </div>

        {/* stat strip */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <StatBox label="Total orders" val={orders.length} />
          <StatBox label="Revenue" val={rupees(totalRevenue)} color="var(--green)" />
          <StatBox label="Users" val={profiles.length} />
        </div>

        {/* search */}
        <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={{ background: "var(--card)", border: "1.5px solid var(--line)" }}>
          <span style={{ color: "var(--muted)" }}>🔍</span>
          <input className="border-0 flex-1 text-[14px] font-medium bg-transparent outline-none"
                 placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="border-0 bg-transparent text-[16px] cursor-pointer" style={{ color: "var(--muted)" }} onClick={() => setSearch("")}>✕</button>}
        </div>
      </div>

      {/* tab content */}
      <div className="px-4 pt-3 pb-4">
        {tab === "orders" && (
          filteredOrders.length === 0
            ? <Empty emo="📋" title="No orders" sub="Nothing matches your search." />
            : filteredOrders.map((o) => <OrderRow key={o.id} o={o} />)
        )}

        {tab === "vendors" && (
          filteredVendors.length === 0
            ? <Empty emo="🏪" title="No vendors" sub="Nothing matches your search." />
            : filteredVendors.map((v) => (
              <div key={v.id} className="card mb-2.5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-[10px] grid place-items-center text-[22px] flex-none" style={{ background: "var(--vendor-bg)" }}>{v.emoji}</div>
                <div className="flex-1 min-w-0">
                  <b className="text-[14px] block">{v.name}</b>
                  <small className="text-[11.5px]" style={{ color: "var(--muted)" }}>{v.tag} · ⚡{v.eta_minutes} min · ★{v.rating}</small>
                </div>
                <button className="text-[11px] font-extrabold px-2.5 py-1 rounded-full border-0 cursor-pointer text-white"
                        style={{ background: "var(--red)" }}
                        onClick={() => deleteVendor(v)}>Delete</button>
                <Toggle on={v.is_active} onChange={() => toggleVendor(v)} />
              </div>
            ))
        )}

        {tab === "products" && (
          filteredProducts.length === 0
            ? <Empty emo="📦" title="No products" sub="Nothing matches your search." />
            : filteredProducts.map((p) => (
              <div key={p.id} className="card mb-2.5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-[10px] grid place-items-center text-[22px] flex-none" style={{ background: "var(--paper)" }}>{p.emoji}</div>
                <div className="flex-1 min-w-0">
                  <b className="text-[14px] block">{p.name}</b>
                  <small className="text-[11.5px]" style={{ color: "var(--muted)" }}>{p.vendor?.name} · {rupees(p.price_paise)} · {p.category}</small>
                </div>
                <button className="text-[11px] font-extrabold px-2.5 py-1 rounded-full border-0 cursor-pointer text-white"
                        style={{ background: "var(--red)" }}
                        onClick={() => deleteProduct(p)}>Delete</button>
                <Toggle on={p.is_available} onChange={() => toggleProduct(p)} />
              </div>
            ))
        )}

        {tab === "users" && (
          filteredUsers.length === 0
            ? <Empty emo="👥" title="No users" sub="Nothing matches your search." />
            : filteredUsers.map((u) => (
              <div key={u.id} className="card mb-2.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full grid place-items-center font-black text-[15px] flex-none"
                     style={{ background: u.is_admin ? "var(--amber)" : "var(--paper)", color: "var(--ink)" }}>
                  {(u.full_name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <b className="text-[14px] block">{u.full_name || "—"}</b>
                  <small className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                    {rupees(u.wallet_paise ?? 0)} wallet
                    {u.is_admin && <span className="ml-1.5 font-extrabold" style={{ color: "var(--amber-deep)" }}>· admin</span>}
                  </small>
                </div>
                <button className="text-[11px] font-extrabold px-2.5 py-1 rounded-full border-0 cursor-pointer text-white"
                        style={{ background: "var(--red)" }}
                        onClick={() => deleteUser(u)}>Delete</button>
                <button className="text-[11px] font-extrabold px-2.5 py-1 rounded-full border-0 cursor-pointer"
                        style={{ background: u.is_admin ? "var(--red)" : "var(--green-soft)", color: u.is_admin ? "#fff" : "#1f7a44" }}
                        onClick={() => toggleAdmin(u)}>
                  {u.is_admin ? "Revoke" : "Make admin"}
                </button>
              </div>
            ))
        )}
      </div>

      {/* bottom nav */}
      <div className="absolute bottom-0 left-0 right-0 flex px-1.5 pt-2 pb-2 z-30"
           style={{ background: "var(--card)", borderTop: "1.5px solid var(--line)" }}>
        {TABS.map(([t, ico, label]) => {
          const on = tab === t;
          return (
            <button key={t} className="flex-1 border-0 bg-transparent flex flex-col items-center gap-0.5 cursor-pointer py-1.5"
                    style={{ color: on ? "var(--ink)" : "var(--muted)" }}
                    onClick={() => { setTab(t); setSearch(""); }}>
              <span className="text-[20px] leading-none">{ico}</span>
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OrderRow({ o }) {
  const [expanded, setExpanded] = useState(false);
  const [bg, color] = STATUS_COLORS[o.status] ?? ["var(--line)", "#6a6555"];
  const itemCount = (o.order_items || []).reduce((s, i) => s + i.quantity, 0);
  return (
    <div className="card mb-2.5 cursor-pointer" onClick={() => setExpanded((x) => !x)}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <b className="text-[13.5px] block font-extrabold">{o.buyer?.full_name || "Unknown"}</b>
          <small className="text-[11px]" style={{ color: "var(--muted)", fontFamily: "'Spline Sans Mono'" }}>
            #{o.id.slice(0, 6)} · {itemCount} item{itemCount !== 1 ? "s" : ""} · {rupees(o.total_paise)}
          </small>
        </div>
        <span className="text-[10px] font-extrabold px-2 py-1 rounded-full flex-none"
              style={{ background: bg, color }}>{o.status}</span>
      </div>
      {expanded && (
        <div className="mt-2.5 pt-2.5" style={{ borderTop: "1.5px solid var(--line)" }}>
          <Row label="Vendor" val={o.vendor?.name || (o.is_custom ? "Custom" : "—")} />
          <Row label="Runner" val={o.runner?.full_name || "Unassigned"} />
          <Row label="Drop" val={o.drop_location} />
          <Row label="Payment" val={o.payment_method} />
          <div className="mt-2 rounded-[10px] p-2.5" style={{ background: "var(--paper)" }}>
            {(o.order_items || []).map((it) => (
              <div key={it.id} className="flex gap-2 text-[12.5px] font-semibold py-0.5">
                <span>{it.emoji}</span><span className="flex-1">{it.name}</span>
                <span style={{ color: "var(--muted)", fontFamily: "'Spline Sans Mono'" }}>×{it.quantity}</span>
                <span style={{ fontFamily: "'Spline Sans Mono'" }}>{rupees(it.unit_price_paise * it.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, val }) {
  return (
    <div className="flex justify-between text-[12.5px] py-0.5">
      <span style={{ color: "var(--muted)", fontWeight: 600 }}>{label}</span>
      <span className="font-bold">{val || "—"}</span>
    </div>
  );
}

function StatBox({ label, val, color }) {
  return (
    <div className="rounded-[12px] p-3 text-center" style={{ background: "var(--card)", border: "1.5px solid var(--line)" }}>
      <b className="block font-black text-[16px]" style={{ color: color || "var(--ink)" }}>{val}</b>
      <small className="text-[10px] font-bold uppercase" style={{ color: "var(--muted)" }}>{label}</small>
    </div>
  );
}

function Pill({ color, label }) {
  return (
    <span className="text-[10.5px] font-extrabold px-2 py-1 rounded-full text-white"
          style={{ background: color }}>{label}</span>
  );
}

function Toggle({ on, onChange }) {
  return (
    <div className={`switch ${on ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); onChange(); }} />
  );
}
