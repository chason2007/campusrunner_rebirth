import { useCallback, useEffect, useState } from "react";
import {
  adminGetAllOrders, adminGetAllProfiles, adminGetVendors, adminGetProducts,
  adminSetVendorActive, adminSetProductAvailable, adminSetUserAdmin,
  rupees, subscribeOrders,
} from "../lib/api";
import { supabase } from "../lib/supabase";

const NAV = [
  { id: "orders",   ico: "📋", label: "Orders" },
  { id: "vendors",  ico: "🏪", label: "Vendors" },
  { id: "products", ico: "📦", label: "Products" },
  { id: "users",    ico: "👥", label: "Users" },
];

const STATUS_BADGE = {
  PLACED:    "badge-placed",
  ACCEPTED:  "badge-accepted",
  SHOPPING:  "badge-shopping",
  PURCHASED: "badge-purchased",
  DELIVERED: "badge-delivered",
  COMPLETED: "badge-completed",
  CANCELLED: "badge-cancelled",
  DISPUTED:  "badge-disputed",
};

export default function AdminDashboard({ profile, onSignOut }) {
  const [page, setPage]       = useState("orders");
  const [search, setSearch]   = useState("");
  const [orders, setOrders]   = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [toast, setToast]     = useState("");
  const [modal, setModal]     = useState(null); // { type, data }

  const loadOrders   = useCallback(() => adminGetAllOrders().then(setOrders), []);
  const loadProfiles = useCallback(() => adminGetAllProfiles().then(setProfiles), []);
  const loadVendors  = useCallback(() => adminGetVendors().then(setVendors), []);
  const loadProducts = useCallback(() => adminGetProducts().then(setProducts), []);

  useEffect(() => { loadOrders(); const off = subscribeOrders(loadOrders); return off; }, [loadOrders]);
  useEffect(() => { loadProfiles(); }, [loadProfiles]);
  useEffect(() => { loadVendors(); }, [loadVendors]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function toggleVendor(v) {
    try { await adminSetVendorActive(v.id, !v.is_active); loadVendors(); notify(v.is_active ? "Vendor paused" : "Vendor activated"); }
    catch (e) { notify("⚠️ " + e.message); }
  }
  async function toggleProduct(p) {
    try { await adminSetProductAvailable(p.id, !p.is_available); loadProducts(); notify(p.is_available ? "Product hidden" : "Product listed"); }
    catch (e) { notify("⚠️ " + e.message); }
  }
  async function toggleAdmin(u) {
    if (u.id === profile.id) return notify("Can't change your own admin status");
    try { await adminSetUserAdmin(u.id, !u.is_admin); loadProfiles(); notify(u.is_admin ? "Admin revoked" : "Admin granted"); }
    catch (e) { notify("⚠️ " + e.message); }
  }

  const q = search.toLowerCase();
  const filteredOrders   = orders.filter((o) => !q || o.id.includes(q) || o.buyer?.full_name?.toLowerCase().includes(q) || o.runner?.full_name?.toLowerCase().includes(q) || o.status.toLowerCase().includes(q) || o.vendor?.name?.toLowerCase().includes(q));
  const filteredVendors  = vendors.filter((v) => !q || v.name.toLowerCase().includes(q) || v.tag?.toLowerCase().includes(q));
  const filteredProducts = products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.vendor?.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));
  const filteredProfiles = profiles.filter((u) => !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));

  const completed   = orders.filter((o) => o.status === "COMPLETED");
  const active      = orders.filter((o) => !["COMPLETED", "PLACED", "CANCELLED"].includes(o.status));
  const pending     = orders.filter((o) => o.status === "PLACED");
  const revenue     = completed.reduce((s, o) => s + o.total_paise, 0);
  const disputed    = orders.filter((o) => o.status === "DISPUTED");

  return (
    <div className="admin-layout">
      {/* sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="Campus Runner Logo" className="sidebar-brand-logo" />
          <h1>Campus Runner</h1>
          <small>Superadmin</small>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ id, ico, label }) => (
            <button key={id} className={`nav-item ${page === id ? "active" : ""}`}
                    onClick={() => { setPage(id); setSearch(""); }}>
              <span className="nav-ico">{ico}</span>
              {label}
              {id === "orders" && pending.length > 0 && <span className="nav-badge">{pending.length}</span>}
              {id === "orders" && disputed.length > 0 && <span className="nav-badge" style={{ background: "var(--red)", marginLeft: 4 }}>!</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div className="avatar" style={{ background: "var(--amber-dim)", color: "var(--amber)" }}>
              {(profile.full_name || "A")[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.full_name || "Admin"}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.email}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={onSignOut}>Sign out</button>
        </div>
      </aside>

      {/* main */}
      <div className="main">
        {/* topbar */}
        <div className="topbar">
          <div className="search-wrap">
            <span className="search-ico">🔍</span>
            <input placeholder={`Search ${page}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 14 }} onClick={() => setSearch("")}>✕</button>}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {page === "vendors" && <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: "vendor", data: null })}>+ Add vendor</button>}
            {page === "products" && <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: "product", data: null })}>+ Add product</button>}
          </div>
        </div>

        <div className="page">
          {/* stat strip — orders page */}
          {page === "orders" && (
            <div className="stat-grid">
              <StatCard label="Total orders" val={orders.length} />
              <StatCard label="Revenue" val={rupees(revenue)} color="var(--green)" />
              <StatCard label="Pending" val={pending.length} color="var(--amber)" sub="awaiting runner" />
              <StatCard label="Active runs" val={active.length} color="var(--blue)" sub="in progress" />
              <StatCard label="Disputed" val={disputed.length} color={disputed.length > 0 ? "var(--red)" : undefined} />
            </div>
          )}

          {page === "users" && (
            <div className="stat-grid">
              <StatCard label="Total users" val={profiles.length} />
              <StatCard label="Admins" val={profiles.filter((u) => u.is_admin).length} color="var(--amber)" />
              <StatCard label="Wallet funds" val={rupees(profiles.reduce((s, u) => s + (u.wallet_paise || 0), 0))} color="var(--green)" />
            </div>
          )}

          {page === "vendors" && (
            <div className="stat-grid">
              <StatCard label="Vendors" val={vendors.length} />
              <StatCard label="Active" val={vendors.filter((v) => v.is_active).length} color="var(--green)" />
              <StatCard label="Paused" val={vendors.filter((v) => !v.is_active).length} color="var(--red)" />
            </div>
          )}

          {page === "products" && (
            <div className="stat-grid">
              <StatCard label="Products" val={products.length} />
              <StatCard label="Listed" val={products.filter((p) => p.is_available).length} color="var(--green)" />
              <StatCard label="Hidden" val={products.filter((p) => !p.is_available).length} color="var(--red)" />
            </div>
          )}

          {/* tables */}
          {page === "orders" && <OrdersTable rows={filteredOrders} />}
          {page === "vendors" && <VendorsTable rows={filteredVendors} onToggle={toggleVendor} onEdit={(v) => setModal({ type: "vendor", data: v })} />}
          {page === "products" && <ProductsTable rows={filteredProducts} onToggle={toggleProduct} onEdit={(p) => setModal({ type: "product", data: p })} />}
          {page === "users" && <UsersTable rows={filteredProfiles} currentId={profile.id} onToggleAdmin={toggleAdmin} />}
        </div>
      </div>

      {/* modals */}
      {modal?.type === "vendor"  && <VendorModal  data={modal.data} vendors={vendors} onClose={() => setModal(null)} onSave={() => { loadVendors();  setModal(null); notify("Saved"); }} />}
      {modal?.type === "product" && <ProductModal data={modal.data} vendors={vendors} onClose={() => setModal(null)} onSave={() => { loadProducts(); setModal(null); notify("Saved"); }} />}

      {/* toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 13.5, zIndex: 200, whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Orders table ── */
function OrdersTable({ rows }) {
  const [expanded, setExpanded] = useState(null);
  if (!rows.length) return <Empty ico="📋" msg="No orders found" />;
  return (
    <div className="table-wrap">
      <div className="table-header"><h2>Orders <span style={{ color: "var(--muted)", fontWeight: 500 }}>({rows.length})</span></h2></div>
      <table>
        <thead><tr>
          <th>ID</th><th>Buyer</th><th>Runner</th><th>Vendor</th>
          <th>Total</th><th>Payment</th><th>Status</th><th>Date</th>
        </tr></thead>
        <tbody>
          {rows.map((o) => {
            const isExp = expanded === o.id;
            const items = o.order_items || [];
            return (
              <>
                <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setExpanded(isExp ? null : o.id)}>
                  <td><span className="mono text-muted">#{o.id.slice(0, 8)}</span></td>
                  <td>{o.buyer?.full_name || "—"}</td>
                  <td>{o.runner?.full_name || <span className="text-muted">Unassigned</span>}</td>
                  <td>{o.vendor?.name || (o.is_custom ? <span style={{ color: "var(--purple)" }}>Custom</span> : "—")}</td>
                  <td><span className="mono">{rupees(o.total_paise)}</span></td>
                  <td><span className="text-muted">{o.payment_method}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[o.status] || "badge-placed"}`}>{o.status}</span></td>
                  <td><span className="text-muted">{new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></td>
                </tr>
                {isExp && (
                  <tr className="expand-row">
                    <td colSpan={8}>
                      <div className="expand-body">
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 14 }}>
                          <KV label="Drop location" val={o.drop_location} />
                          <KV label="Payment status" val={o.payment_status} />
                          <KV label="Runner rating" val={o.runner_rating ? `${o.runner_rating} / 5` : "Not yet rated"} />
                          {o.is_custom && <KV label="Custom title" val={o.custom_title} />}
                          {o.is_custom && <KV label="Details" val={o.custom_details || "—"} />}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 8 }}>Items</div>
                        <table style={{ background: "var(--surface)" }}>
                          <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Subtotal</th><th>Collected</th></tr></thead>
                          <tbody>
                            {items.map((it) => (
                              <tr key={it.id}>
                                <td>{it.emoji} {it.name}</td>
                                <td>{it.quantity}</td>
                                <td className="mono">{rupees(it.unit_price_paise)}</td>
                                <td className="mono">{rupees(it.unit_price_paise * it.quantity)}</td>
                                <td>{it.is_collected ? <span className="text-green">✓</span> : <span className="text-muted">—</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Vendors table ── */
function VendorsTable({ rows, onToggle, onEdit }) {
  if (!rows.length) return <Empty ico="🏪" msg="No vendors found" />;
  return (
    <div className="table-wrap">
      <div className="table-header"><h2>Vendors <span style={{ color: "var(--muted)", fontWeight: 500 }}>({rows.length})</span></h2></div>
      <table>
        <thead><tr><th>Vendor</th><th>Category</th><th>ETA</th><th>Rating</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 22 }}>{v.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{v.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{v.tag}</div>
                  </div>
                </div>
              </td>
              <td><span className="text-muted">{v.category || "—"}</span></td>
              <td><span className="mono">{v.eta_minutes} min</span></td>
              <td><span style={{ color: "var(--amber)", fontWeight: 700 }}>★ {v.rating}</span></td>
              <td><span className={`badge ${v.is_active ? "badge-active" : "badge-inactive"}`}>{v.is_active ? "Active" : "Paused"}</span></td>
              <td>
                <div className="flex items-center gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={() => onEdit(v)}>Edit</button>
                  <button className={`toggle ${v.is_active ? "on" : ""}`} onClick={() => onToggle(v)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Products table ── */
function ProductsTable({ rows, onToggle, onEdit }) {
  if (!rows.length) return <Empty ico="📦" msg="No products found" />;
  return (
    <div className="table-wrap">
      <div className="table-header"><h2>Products <span style={{ color: "var(--muted)", fontWeight: 500 }}>({rows.length})</span></h2></div>
      <table>
        <thead><tr><th>Product</th><th>Vendor</th><th>Category</th><th>Price</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 20 }}>{p.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.description}</div>
                  </div>
                </div>
              </td>
              <td><span className="text-muted">{p.vendor?.name || "—"}</span></td>
              <td><span className="text-muted">{p.category || "—"}</span></td>
              <td><span className="mono">{rupees(p.price_paise)}</span></td>
              <td><span className={`badge ${p.is_available ? "badge-active" : "badge-inactive"}`}>{p.is_available ? "Listed" : "Hidden"}</span></td>
              <td>
                <div className="flex items-center gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={() => onEdit(p)}>Edit</button>
                  <button className={`toggle ${p.is_available ? "on" : ""}`} onClick={() => onToggle(p)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Users table ── */
function UsersTable({ rows, currentId, onToggleAdmin }) {
  if (!rows.length) return <Empty ico="👥" msg="No users found" />;
  return (
    <div className="table-wrap">
      <div className="table-header"><h2>Users <span style={{ color: "var(--muted)", fontWeight: 500 }}>({rows.length})</span></h2></div>
      <table>
        <thead><tr><th>User</th><th>Wallet</th><th>Rating</th><th>Joined</th><th>Role</th><th></th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>
                <div className="flex items-center gap-2">
                  <div className="avatar" style={{ background: u.is_admin ? "var(--amber-dim)" : "var(--surface2)", color: u.is_admin ? "var(--amber)" : "var(--muted)" }}>
                    {(u.full_name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{u.full_name || "—"} {u.id === currentId && <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>(you)</span>}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{u.email}</div>
                  </div>
                </div>
              </td>
              <td><span className="mono text-green">{rupees(u.wallet_paise || 0)}</span></td>
              <td>
                {u.rating_count > 0
                  ? <span style={{ color: "var(--amber)", fontWeight: 700 }}>★ {(u.rating_sum / u.rating_count).toFixed(1)} <span style={{ color: "var(--muted)", fontWeight: 500 }}>({u.rating_count})</span></span>
                  : <span className="text-muted">—</span>}
              </td>
              <td><span className="text-muted">{new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></td>
              <td>
                {u.is_admin
                  ? <span className="badge badge-admin">Admin</span>
                  : <span className="badge badge-placed">User</span>}
              </td>
              <td>
                <button className={`btn btn-sm ${u.is_admin ? "btn-danger" : "btn-ghost"}`}
                        disabled={u.id === currentId}
                        onClick={() => onToggleAdmin(u)}>
                  {u.is_admin ? "Revoke admin" : "Make admin"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Vendor modal ── */
function VendorModal({ data, onClose, onSave }) {
  const isNew = !data;
  const [form, setForm] = useState({
    name: data?.name || "", emoji: data?.emoji || "",
    tag: data?.tag || "", category: data?.category || "food",
    eta_minutes: data?.eta_minutes ?? 10,
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      if (isNew) {
        const { error } = await supabase.from("vendors").insert({ ...form, eta_minutes: Number(form.eta_minutes) });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vendors").update({ ...form, eta_minutes: Number(form.eta_minutes) }).eq("id", data.id);
        if (error) throw error;
      }
      onSave();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  }

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isNew ? "Add vendor" : "Edit vendor"}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 12 }}>
            <div className="field"><label>Name</label><input value={form.name} onChange={f("name")} placeholder="Chai Point" /></div>
            <div className="field"><label>Emoji</label><input value={form.emoji} onChange={f("emoji")} placeholder="☕" /></div>
          </div>
          <div className="field"><label>Tag line</label><input value={form.tag} onChange={f("tag")} placeholder="Café · Block A" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Category</label>
              <select value={form.category} onChange={f("category")}>
                {["food","drinks","print","stationery","essentials"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>ETA (minutes)</label><input type="number" min="1" value={form.eta_minutes} onChange={f("eta_minutes")} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !form.name} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Product modal ── */
function ProductModal({ data, vendors, onClose, onSave }) {
  const isNew = !data;
  const [form, setForm] = useState({
    vendor_id: data?.vendor_id || vendors[0]?.id || "",
    name: data?.name || "", description: data?.description || "",
    emoji: data?.emoji || "", category: data?.category || "food",
    price_paise: data?.price_paise ? data.price_paise / 100 : "",
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const payload = { ...form, price_paise: Math.round(parseFloat(form.price_paise) * 100) };
    try {
      if (isNew) {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").update(payload).eq("id", data.id);
        if (error) throw error;
      }
      onSave();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  }

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isNew ? "Add product" : "Edit product"}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Vendor</label>
            <select value={form.vendor_id} onChange={f("vendor_id")}>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.emoji} {v.name}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 12 }}>
            <div className="field"><label>Name</label><input value={form.name} onChange={f("name")} placeholder="Masala chai" /></div>
            <div className="field"><label>Emoji</label><input value={form.emoji} onChange={f("emoji")} placeholder="☕" /></div>
          </div>
          <div className="field"><label>Description</label><input value={form.description} onChange={f("description")} placeholder="Hot and spiced" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Category</label>
              <select value={form.category} onChange={f("category")}>
                {["food","drinks","print","stationery","essentials"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Price (₹)</label><input type="number" min="0" step="0.5" value={form.price_paise} onChange={f("price_paise")} placeholder="20" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !form.name || !form.price_paise || !form.vendor_id} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */
function StatCard({ label, val, color, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-val" style={{ color: color || "var(--text)" }}>{val}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function KV({ label, val }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{val || "—"}</div>
    </div>
  );
}

function Empty({ ico, msg }) {
  return (
    <div className="table-wrap">
      <div className="empty"><div className="empty-ico">{ico}</div><p>{msg}</p></div>
    </div>
  );
}
