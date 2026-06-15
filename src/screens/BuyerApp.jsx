import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES, PAYS, RUNNER_FEE_PAISE, PLATFORM_FEE_RATE } from "../lib/constants";
import {
  getVendors, getProducts, getMyOrders, placeOrder, confirmOrder,
  subscribeOrders, rupees, surgeFeePaise,
} from "../lib/api";
import { Timeline, Empty } from "../components/UI";

export default function BuyerApp({ toast }) {
  const { session, refreshProfile } = useAuth();
  const uid = session.user.id;
  const [tab, setTab] = useState("home");
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({});   // id -> {product, qty}
  const [pay, setPay] = useState("WALLET");
  const [openVendor, setOpenVendor] = useState(null);
  const [custom, setCustom] = useState({ title: "", details: "", budget: "" });
  const [drop, setDrop] = useState("Library steps");

  useEffect(() => { getVendors().then(setVendors); getProducts().then(setProducts); }, []);
  const loadOrders = useCallback(() => getMyOrders(uid).then(setOrders), [uid]);
  useEffect(() => { loadOrders(); const off = subscribeOrders(loadOrders); return off; }, [loadOrders]);

  const cartList = Object.values(cart);
  const cartCount = cartList.reduce((s, i) => s + i.qty, 0);
  const subtotal = cartList.reduce((s, i) => s + i.product.price_paise * i.qty, 0);

  function addToCart(p) {
    const existingVendor = cartList[0]?.product.vendor_id;
    if (existingVendor && existingVendor !== p.vendor_id) {
      if (!confirm("Your cart has items from another shop. Start a new cart?")) return;
      setCart({ [p.id]: { product: p, qty: 1 } });
      return;
    }
    setCart((c) => ({ ...c, [p.id]: { product: p, qty: (c[p.id]?.qty || 0) + 1 } }));
  }
  function changeQty(id, d) {
    setCart((c) => {
      const next = { ...c };
      const q = (next[id]?.qty || 0) + d;
      if (q <= 0) delete next[id]; else next[id] = { ...next[id], qty: q };
      return next;
    });
  }

  const filtered = useMemo(() => {
    let list = products;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
    } else if (cat !== "all") list = list.filter((p) => p.category === cat);
    return list;
  }, [products, cat, search]);

  async function checkout() {
    const isCustom = tab === "customCart";
    try {
      const items = isCustom
        ? [{ product_id: "", name: custom.title, emoji: "✋",
             unit_price_paise: (parseInt(custom.budget) || 0) * 100, quantity: 1 }]
        : cartList.map((i) => ({
            product_id: i.product.id, name: i.product.name, emoji: i.product.emoji,
            unit_price_paise: i.product.price_paise, quantity: i.qty }));
      await placeOrder({
        vendorId: isCustom ? null : cartList[0]?.product.vendor_id,
        isCustom, customTitle: custom.title, customDetails: custom.details,
        drop, items, payment: pay,
      });
      setCart({}); setCustom({ title: "", details: "", budget: "" });
      await refreshProfile(uid); loadOrders();
      toast(pay === "COD" ? "Order placed — pay cash on delivery" : "Order placed — funds held");
      setTab("orders");
    } catch (e) { toast("⚠️ " + e.message); }
  }

  async function confirm(orderId) {
    try { await confirmOrder(orderId, 5); await refreshProfile(uid); loadOrders(); toast("⭐ Confirmed — runner paid"); }
    catch (e) { toast("⚠️ " + e.message); }
  }

  // ---------- render helpers ----------
  const vendorOf = (id) => vendors.find((v) => v.id === id);

  function ProductGrid({ list }) {
    if (!list.length) return <Empty emo="🔍" title="Nothing here" sub="Try a custom request instead." />;
    return (
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        {list.map((p) => {
          const inCart = cart[p.id];
          return (
            <div key={p.id} className="card !p-2.5 flex flex-col">
              <div className="h-[88px] rounded-[11px] grid place-items-center text-[40px] mb-2" style={{ background: "var(--paper)" }}>{p.emoji}</div>
              <b className="text-[13.5px] leading-tight">{p.name}</b>
              <div className="text-[11px] font-medium flex-1 mt-0.5" style={{ color: "var(--muted)" }}>{p.description} · {vendorOf(p.vendor_id)?.name}</div>
              <div className="flex items-center justify-between mt-2">
                <span className="font-black text-[15px]">{rupees(p.price_paise)}</span>
                {inCart ? (
                  <Stepper q={inCart.qty} onMinus={() => changeQty(p.id, -1)} onPlus={() => changeQty(p.id, 1)} />
                ) : (
                  <button className="font-extrabold text-[13px] px-[15px] py-[7px] rounded-[9px]"
                          style={{ border: "1.5px solid var(--amber-deep)", background: "var(--amber)", color: "var(--ink)" }}
                          onClick={() => addToCart(p)}>ADD</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {/* delivery + search header (hidden on cart/orders/custom) */}
      {(tab === "home" || tab === "vendor") && (
        <div className="px-4 pt-3.5 pb-3.5 sticky top-0 z-40" style={{ background: "var(--ink)", color: "var(--paper)" }}>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <b className="font-black text-[15px] flex items-center gap-1.5"><span style={{ color: "var(--amber)" }}>⚡</span> 8–12 min · {drop || "Set drop-off"}</b>
              <small className="text-[11.5px]" style={{ color: "rgba(246,243,234,.6)" }}>Delivered by a student near you</small>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: "var(--card)" }}>
            <span style={{ color: "var(--muted)" }}>🔍</span>
            <input className="border-0 flex-1 text-[14.5px] font-medium bg-transparent outline-none text-ink"
                   placeholder="Search samosa, pens, printouts…" value={search}
                   onChange={(e) => { setSearch(e.target.value); setTab("home"); }} />
          </div>
        </div>
      )}

      <div className="screen">
        {tab === "home" && (
          <>
            <div className="flex gap-2.5 overflow-x-auto px-4 pt-3.5 pb-1" style={{ scrollbarWidth: "none" }}>
              {CATEGORIES.map((c) => (
                <div key={c.id} className="flex flex-col items-center gap-1.5 cursor-pointer w-16" onClick={() => { setCat(c.id); setSearch(""); }}>
                  <div className="w-[60px] h-[60px] rounded-2xl grid place-items-center text-[27px] transition-transform"
                       style={{ background: cat === c.id ? "var(--amber)" : "var(--card)", border: `1.5px solid ${cat === c.id ? "var(--amber-deep)" : "var(--line)"}`, transform: cat === c.id ? "translateY(-2px)" : "none" }}>{c.emo}</div>
                  <span className="text-[10.5px] font-bold text-center leading-tight" style={{ color: cat === c.id ? "var(--ink)" : "#5a5648" }}>{c.label}</span>
                </div>
              ))}
            </div>

            <div className="mx-4 mt-3.5 mb-1 rounded-[18px] p-[18px] relative overflow-hidden"
                 style={{ background: "linear-gradient(110deg,var(--amber),var(--amber-deep))" }}>
              <h2 className="font-black text-[19px] text-ink leading-tight">{surgeFeePaise() ? "Peak hour rush ⚡" : "Between classes?"}</h2>
              <p className="text-[12.5px] font-semibold mt-0.5" style={{ color: "rgba(22,20,15,.7)" }}>A runner brings it to your spot</p>
              <div className="absolute -right-1.5 -bottom-3.5 text-[74px] opacity-20" style={{ transform: "rotate(-12deg)" }}>🏃</div>
            </div>

            <div className="flex items-baseline justify-between px-4 pt-5 pb-2.5"><h3 className="font-black text-[17px]">Shops on campus</h3></div>
            <div className="flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
              {vendors.map((v) => (
                <div key={v.id} className="card !p-0 flex-none w-[148px] overflow-hidden cursor-pointer" onClick={() => { setOpenVendor(v.id); setTab("vendor"); }}>
                  <div className="h-[84px] grid place-items-center text-[38px] relative" style={{ background: "var(--vendor-bg)" }}>{v.emoji}
                    <span className="absolute left-2 bottom-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md text-paper" style={{ background: "rgba(22,20,15,.85)" }}>⚡ {v.eta_minutes} min</span>
                  </div>
                  <div className="p-2.5 pb-3"><b className="text-[14px] block">{v.name}</b><small className="text-[11px]" style={{ color: "var(--muted)" }}>{v.tag}</small>
                    <span className="inline-flex items-center gap-0.5 text-[10.5px] font-extrabold px-1.5 py-0.5 rounded mt-1.5 text-white" style={{ background: "var(--green)" }}>★ {v.rating}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mx-4 my-1 rounded-[18px] p-[18px] relative overflow-hidden cursor-pointer" style={{ background: "var(--ink)", color: "var(--paper)" }} onClick={() => setTab("custom")}>
              <h3 className="font-black text-[17px] flex items-center gap-2">✋ Can't find it?</h3>
              <p className="text-[12.5px] font-medium mt-1 max-w-[78%]" style={{ color: "rgba(246,243,234,.65)" }}>Send a runner for anything — a printout, a charger, a specific snack.</p>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-[38px] h-[38px] rounded-full grid place-items-center text-xl font-extrabold" style={{ background: "var(--amber)", color: "var(--ink)" }}>→</div>
            </div>

            <div className="flex items-baseline justify-between px-4 pt-5 pb-2.5"><h3 className="font-black text-[17px]">{cat === "all" ? "Popular right now" : CATEGORIES.find((c) => c.id === cat).label}</h3></div>
            <ProductGrid list={filtered} />
          </>
        )}

        {tab === "vendor" && (() => {
          const v = vendorOf(openVendor);
          const items = products.filter((p) => p.vendor_id === openVendor);
          return (
            <>
              <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-1"><BackBtn onClick={() => setTab("home")} /></div>
              <div className="px-4 pt-1.5 flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-2xl grid place-items-center text-[34px]" style={{ background: "var(--vendor-bg)" }}>{v.emoji}</div>
                <div><h1 className="big text-[22px]">{v.name}</h1><div className="sub mt-0">{v.tag} · <span className="font-extrabold" style={{ color: "var(--green)" }}>★ {v.rating}</span></div></div>
              </div>
              <div className="flex items-baseline justify-between px-4 pt-5 pb-2.5"><h3 className="font-black text-[17px]">Menu</h3></div>
              <ProductGrid list={items} />
            </>
          );
        })()}

        {tab === "custom" && (
          <>
            <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-1"><BackBtn onClick={() => setTab("home")} /><div className="eyebrow">Custom run</div></div>
            <div className="px-4 pt-1"><h1 className="big">Send a runner<br />for anything</h1><p className="sub mb-4 mt-1">Describe it. A runner sources it; you pay the bill + a fee.</p></div>
            <div className="card mx-4 mb-3.5">
              <div className="field mb-3.5"><label>What do you need</label><input placeholder="Print my 30-page report, spiral bound" value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} /></div>
              <div className="field mb-3.5"><label>Details for the runner</label><textarea className="min-h-[72px] resize-none" placeholder="Where to get it, specifics…" value={custom.details} onChange={(e) => setCustom({ ...custom, details: e.target.value })} /></div>
              <div className="field"><label>Estimated item budget ₹</label><input inputMode="numeric" placeholder="100" value={custom.budget} onChange={(e) => setCustom({ ...custom, budget: e.target.value })} /></div>
            </div>
            <div className="px-4"><button className="btn btn-dark" onClick={() => { if (!custom.title.trim()) return toast("Add what you need first"); setTab("customCart"); }}>Continue to checkout →</button></div>
          </>
        )}

        {(tab === "cart" || tab === "customCart") && (tab === "customCart" || cartList.length > 0) && (
          <Checkout tab={tab} cartList={cartList} custom={custom} subtotal={tab === "customCart" ? (parseInt(custom.budget) || 0) * 100 : subtotal}
                    pay={pay} setPay={setPay} changeQty={changeQty} onBack={() => setTab(tab === "customCart" ? "custom" : "home")} onPlace={checkout} vendorOf={vendorOf} cartFirst={cartList[0]}
                    drop={drop} setDrop={setDrop} />
        )}

        {tab === "orders" && (
          orders.length === 0 ? <><div className="px-4 pt-4"><div className="eyebrow">Orders</div></div><Empty emo="📋" title="No orders yet" sub="Your runs show here, tracked live." /></>
          : <>
              <div className="px-4 pt-4 pb-1"><div className="eyebrow">Your orders</div><h1 className="big text-[24px]">Track live</h1></div>
              {orders.map((o) => <OrderCard key={o.id} o={o} onConfirm={confirm} vendorOf={vendorOf} />)}
            </>
        )}
      </div>

      {/* floating cart bar */}
      {cartCount > 0 && (tab === "home" || tab === "vendor") && (
        <div className="absolute left-3.5 right-3.5 bottom-[84px] z-[35] rounded-[14px] px-4 py-3 flex items-center justify-between cursor-pointer text-white"
             style={{ background: "var(--green)", boxShadow: "0 8px 24px rgba(31,157,85,.4)" }} onClick={() => setTab("cart")}>
          <div className="flex items-center gap-2.5"><div className="w-[34px] h-[34px] rounded-[9px] grid place-items-center font-black text-[15px]" style={{ background: "rgba(255,255,255,.22)" }}>{cartCount}</div>
            <div><small className="text-[11px] opacity-85 font-semibold block">View cart</small><b className="text-[14.5px] font-extrabold">{rupees(subtotal)}</b></div></div>
          <div className="font-extrabold text-[14.5px]">Checkout →</div>
        </div>
      )}

      {/* bottom nav */}
      <BuyerNav tab={tab} setTab={setTab} />
    </>
  );
}

function Stepper({ q, onMinus, onPlus }) {
  return (
    <div className="flex items-center rounded-[9px] overflow-hidden" style={{ border: "1.5px solid var(--amber-deep)" }}>
      <button className="border-0 font-black text-[16px] w-[30px] h-8" style={{ background: "var(--amber)", color: "var(--ink)" }} onClick={onMinus}>−</button>
      <b className="min-w-[24px] text-center text-[14px] font-extrabold">{q}</b>
      <button className="border-0 font-black text-[16px] w-[30px] h-8" style={{ background: "var(--amber)", color: "var(--ink)" }} onClick={onPlus}>+</button>
    </div>
  );
}
function BackBtn({ onClick }) {
  return <div className="w-9 h-9 rounded-[10px] grid place-items-center text-lg cursor-pointer flex-none" style={{ background: "var(--card)", border: "1.5px solid var(--line)" }} onClick={onClick}>←</div>;
}

function Checkout({ tab, cartList, custom, subtotal, pay, setPay, changeQty, onBack, onPlace, vendorOf, cartFirst, drop, setDrop }) {
  const isCustom = tab === "customCart";
  const runnerFee = RUNNER_FEE_PAISE, surge = surgeFeePaise();
  const platform = Math.round((subtotal + runnerFee + surge) * PLATFORM_FEE_RATE);
  const total = subtotal + runnerFee + surge + platform;
  const vendorName = isCustom ? "Custom request" : vendorOf(cartFirst?.product.vendor_id)?.name || "";
  return (
    <>
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-1"><BackBtn onClick={onBack} /><div className="eyebrow">Checkout</div></div>
      <div className="px-4 pt-1"><h1 className="big text-[23px]">Your order</h1><div className="sub mb-3">From {vendorName}</div>
        <div className="field mb-4"><label>Drop-off location</label><input placeholder="Library steps, Gate 3…" value={drop} onChange={(e) => setDrop(e.target.value)} /></div>
      </div>
      <div className="card mx-4 mb-3.5">
        {isCustom ? (
          <div className="flex items-center gap-3 py-3"><div className="w-11 h-11 rounded-[10px] grid place-items-center text-[22px]" style={{ background: "var(--paper)" }}>✋</div>
            <div className="flex-1 min-w-0"><b className="text-[14px] block">{custom.title}</b><small className="text-[11.5px]" style={{ color: "var(--muted)" }}>{custom.details || "Custom"}</small></div>
            <span className="font-black text-[14px]">~{rupees(subtotal)}</span></div>
        ) : cartList.map((i) => (
          <div key={i.product.id} className="flex items-center gap-3 py-3 border-b last:border-0" style={{ borderColor: "var(--line)" }}>
            <div className="w-11 h-11 rounded-[10px] grid place-items-center text-[22px]" style={{ background: "var(--paper)" }}>{i.product.emoji}</div>
            <div className="flex-1 min-w-0"><b className="text-[14px] block">{i.product.name}</b><small className="text-[11.5px]" style={{ color: "var(--muted)" }}>{rupees(i.product.price_paise)} each</small></div>
            <Stepper q={i.qty} onMinus={() => changeQty(i.product.id, -1)} onPlus={() => changeQty(i.product.id, 1)} />
            <span className="font-black text-[14px] ml-2.5">{rupees(i.product.price_paise * i.qty)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between px-4 pb-2"><h3 className="font-black text-[15px]">Payment</h3></div>
      <div className="px-4 flex flex-col gap-2.5">
        {Object.entries(PAYS).map(([k, p]) => (
          <div key={k} className="flex items-center gap-3 rounded-xl p-3 cursor-pointer" style={{ border: `1.5px solid ${pay === k ? "var(--ink)" : "var(--line)"}`, background: "var(--card)", boxShadow: pay === k ? "var(--shadow)" : "none" }} onClick={() => setPay(k)}>
            <div className="w-9 h-9 rounded-[9px] grid place-items-center text-[17px]" style={{ background: p.bg }}>{p.ico}</div>
            <div><b className="text-[14px] block">{p.label}</b><small className="text-[11.5px]" style={{ color: "var(--muted)" }}>{p.hint || ""}</small></div>
            <div className="ml-auto w-5 h-5 rounded-full grid place-items-center" style={{ border: `2px solid ${pay === k ? "var(--ink)" : "var(--line)"}`, background: pay === k ? "var(--ink)" : "transparent" }}>{pay === k && <span style={{ color: "var(--amber)", fontSize: 11, fontWeight: 900 }}>✓</span>}</div>
          </div>
        ))}
      </div>

      <div className="mx-4 my-3.5 rounded-2xl p-4" style={{ background: "var(--ink)", color: "var(--paper)" }}>
        <Line label={`Item${isCustom ? " (est.)" : "s"} subtotal`} val={rupees(subtotal)} />
        <Line label="Runner fee" val={rupees(runnerFee)} />
        {surge > 0 && <Line label="Peak boost ⚡" val={rupees(surge)} />}
        <Line label="Platform fee" val={rupees(platform)} />
        <div className="flex justify-between pt-2.5 mt-1.5 font-black text-[18px]" style={{ borderTop: "1px dashed rgba(246,243,234,.2)", fontFamily: "'Archivo Black'" }}><span>To pay</span><span style={{ fontFamily: "'Spline Sans Mono'" }}>{rupees(total)}</span></div>
      </div>
      <div className="px-4"><button className="btn btn-primary" onClick={onPlace}>Place order · {rupees(total)}</button></div>
    </>
  );
}
function Line({ label, val }) {
  return <div className="flex justify-between text-[13px] py-1 font-medium" style={{ color: "rgba(246,243,234,.7)" }}><span>{label}</span><span style={{ fontFamily: "'Spline Sans Mono'" }}>{val}</span></div>;
}

function OrderCard({ o, onConfirm, vendorOf }) {
  const itemCount = (o.order_items || []).reduce((s, i) => s + i.quantity, 0);
  const name = o.is_custom ? "Custom request" : vendorOf(o.vendor_id)?.name || "Order";
  const badge = o.status === "COMPLETED" ? ["var(--green-soft)", "#1f7a44"] : o.status === "PLACED" ? ["var(--line)", "#6a6555"] : ["var(--amber)", "var(--ink)"];
  return (
    <div className="card mx-4 mb-3.5">
      <div className="flex items-start gap-2.5 mb-3">
        <div className="flex-1"><b className="text-[16px] font-extrabold">{name}</b><div className="sub mt-0.5 text-[11.5px]" style={{ fontFamily: "'Spline Sans Mono'" }}>#{o.id.slice(0, 6)} · {itemCount} item{itemCount > 1 ? "s" : ""} · {rupees(o.total_paise)}</div></div>
        <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full uppercase" style={{ background: badge[0], color: badge[1] }}>{o.status}</span>
      </div>
      {o.runner?.full_name && <div className="text-[12px] font-bold mb-3 px-2.5 py-2 rounded-[9px]" style={{ background: "var(--paper)", color: "#5a5648" }}>🏃 {o.runner.full_name}</div>}
      <Timeline status={o.status} />
      {o.status === "DELIVERED" && <button className="btn btn-primary mt-3 !py-3" onClick={() => onConfirm(o.id)}>Confirm received & rate</button>}
    </div>
  );
}

function BuyerNav({ tab, setTab }) {
  const items = [["home", "🏠", "Home"], ["orders", "📋", "Orders"]];
  const isHome = ["home", "vendor"].includes(tab);
  return (
    <div className="absolute bottom-0 left-0 right-0 flex px-1.5 pt-2 pb-2 z-30" style={{ background: "var(--card)", borderTop: "1.5px solid var(--line)" }}>
      {items.map(([t, i, l]) => {
        const on = t === "home" ? isHome : tab === t;
        return <button key={t} className="flex-1 border-0 bg-transparent flex flex-col items-center gap-0.5 cursor-pointer py-1.5" style={{ color: on ? "var(--ink)" : "var(--muted)" }} onClick={() => setTab(t)}><span className="text-[20px] leading-none">{i}</span><span className="text-[10px] font-bold">{l}</span></button>;
      })}
    </div>
  );
}
