import { supabase } from "./supabase";

// money helpers — we store paise everywhere, format rupees for display
export const toRupees = (paise) => Math.round(paise) / 100;
export const rupees = (paise) => "₹" + toRupees(paise).toLocaleString("en-IN");

// surge windows: lunch + late-afternoon crunch
export function surgeFeePaise() {
  const h = new Date().getHours();
  return (h >= 12 && h < 14) || (h >= 16 && h < 17) ? 1200 : 0;
}

// ---------- AUTH (phone OTP) ----------
export async function sendOtp(phone) {
  return supabase.auth.signInWithOtp({ phone });
}
export async function verifyOtp(phone, token) {
  return supabase.auth.verifyOtp({ phone, token, type: "sms" });
}
export async function signOut() {
  return supabase.auth.signOut();
}

// ---------- PROFILE ----------
export async function getProfile(userId) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return data;
}

// ---------- CATALOG ----------
export async function getVendors() {
  const { data } = await supabase.from("vendors").select("*").eq("is_active", true);
  return data ?? [];
}
export async function getProducts() {
  const { data } = await supabase.from("products").select("*").eq("is_available", true);
  return data ?? [];
}

// ---------- ORDERS (buyer) ----------
export async function placeOrder({ vendorId, isCustom, customTitle, customDetails, drop, items, payment }) {
  const { data, error } = await supabase.rpc("place_order", {
    p_vendor: vendorId ?? null,
    p_is_custom: isCustom,
    p_custom_title: customTitle ?? null,
    p_custom_details: customDetails ?? null,
    p_drop: drop,
    p_items: items, // [{product_id,name,emoji,unit_price_paise,quantity}]
    p_payment: payment, // 'WALLET'|'UPI'|'COD'
    p_surge_fee: surgeFeePaise(),
  });
  if (error) throw error;
  return data; // order id
}
export async function getMyOrders(userId) {
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*), runner:profiles!orders_runner_id_fkey(full_name,rating_sum,rating_count)")
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
export async function confirmOrder(orderId, rating) {
  const { error } = await supabase.rpc("confirm_order", { p_order: orderId, p_rating: rating });
  if (error) throw error;
}

// ---------- ORDERS (runner) ----------
export async function getOpenFeed() {
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*), vendor:vendors(name,emoji)")
    .eq("status", "PLACED")
    .order("created_at", { ascending: true });
  return data ?? [];
}
export async function getMyRuns(userId) {
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*), vendor:vendors(name,emoji)")
    .eq("runner_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
export async function acceptOrder(orderId) {
  const { error } = await supabase.rpc("accept_order", { p_order: orderId });
  if (error) throw error;
}
export async function advanceOrder(orderId, toStatus) {
  const { error } = await supabase.rpc("advance_order", { p_order: orderId, p_to: toStatus });
  if (error) throw error;
}
export async function setItemCollected(itemId, collected) {
  const { error } = await supabase.rpc("set_item_collected", { p_item: itemId, p_collected: collected });
  if (error) throw error;
}

// ---------- REALTIME ----------
// Subscribe to any change on orders; caller re-fetches the slices it cares about.
export function subscribeOrders(onChange) {
  const ch = supabase
    .channel("orders-stream")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(ch);
}
