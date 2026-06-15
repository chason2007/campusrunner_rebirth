const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// money helpers — we store paise everywhere, format rupees for display
export const toRupees = (paise) => Math.round(paise) / 100;
export const rupees = (paise) => "₹" + toRupees(paise).toLocaleString("en-IN");

// surge windows: lunch + late-afternoon crunch
export function surgeFeePaise() {
  const h = new Date().getHours();
  return (h >= 12 && h < 14) || (h >= 16 && h < 17) ? 1200 : 0;
}

// Helper for sending request headers with Authorization JWT token
function getHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("session_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// Helper to handle fetch responses and throw cleaner errors
async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

// ---------- AUTH (email + password) ----------
export async function signUp(email, password, fullName) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, fullName }),
  });
  const data = await handleResponse(res);
  if (data.token) {
    localStorage.setItem("session_token", data.token);
    window.dispatchEvent(new Event("auth-changed"));
  }
  return data; // { token, user }
}

export async function signIn(email, password) {
  const res = await fetch(`${API_URL}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await handleResponse(res);
  if (data.token) {
    localStorage.setItem("session_token", data.token);
    window.dispatchEvent(new Event("auth-changed"));
  }
  return data; // { token, user }
}

export async function signOut() {
  localStorage.removeItem("session_token");
  window.dispatchEvent(new Event("auth-changed"));
  return { error: null };
}

// ---------- PROFILE ----------
export async function getProfile(userId) {
  try {
    const res = await fetch(`${API_URL}/auth/profile`, {
      method: "GET",
      headers: getHeaders(),
    });
    return await handleResponse(res);
  } catch (error) {
    console.error("getProfile error:", error);
    return null;
  }
}

// ---------- CATALOG ----------
export async function getVendors() {
  try {
    const res = await fetch(`${API_URL}/vendors`, {
      method: "GET",
      headers: getHeaders(),
    });
    return await handleResponse(res);
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getProducts() {
  try {
    const res = await fetch(`${API_URL}/products`, {
      method: "GET",
      headers: getHeaders(),
    });
    return await handleResponse(res);
  } catch (error) {
    console.error(error);
    return [];
  }
}

// ---------- ORDERS (buyer) ----------
export async function placeOrder({ vendorId, isCustom, customTitle, customDetails, drop, items, payment }) {
  const res = await fetch(`${API_URL}/orders/place`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      vendorId,
      isCustom,
      customTitle,
      customDetails,
      drop,
      items,
      payment,
      surgeFee: surgeFeePaise(),
    }),
  });
  const data = await handleResponse(res);
  return data.orderId;
}

export async function getMyOrders(userId) {
  try {
    const res = await fetch(`${API_URL}/orders/my-orders`, {
      method: "GET",
      headers: getHeaders(),
    });
    return await handleResponse(res);
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function confirmOrder(orderId, rating) {
  const res = await fetch(`${API_URL}/orders/${orderId}/confirm`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ rating }),
  });
  await handleResponse(res);
}

// ---------- ORDERS (runner) ----------
export async function getOpenFeed() {
  try {
    const res = await fetch(`${API_URL}/orders/open-feed`, {
      method: "GET",
      headers: getHeaders(),
    });
    return await handleResponse(res);
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getMyRuns(userId) {
  try {
    const res = await fetch(`${API_URL}/orders/my-runs`, {
      method: "GET",
      headers: getHeaders(),
    });
    return await handleResponse(res);
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function acceptOrder(orderId) {
  const res = await fetch(`${API_URL}/orders/${orderId}/accept`, {
    method: "POST",
    headers: getHeaders(),
  });
  await handleResponse(res);
}

export async function advanceOrder(orderId, toStatus) {
  const res = await fetch(`${API_URL}/orders/${orderId}/advance`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ toStatus }),
  });
  await handleResponse(res);
}

export async function setItemCollected(itemId, collected) {
  const res = await fetch(`${API_URL}/orders/item/${itemId}/collected`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ collected }),
  });
  await handleResponse(res);
}

// ---------- ADMIN ----------
export async function adminGetAllOrders() {
  const res = await fetch(`${API_URL}/admin/orders`, {
    method: "GET",
    headers: getHeaders(),
  });
  return await handleResponse(res);
}

export async function adminGetAllProfiles() {
  const res = await fetch(`${API_URL}/admin/profiles`, {
    method: "GET",
    headers: getHeaders(),
  });
  return await handleResponse(res);
}

export async function adminGetVendors() {
  const res = await fetch(`${API_URL}/admin/vendors`, {
    method: "GET",
    headers: getHeaders(),
  });
  return await handleResponse(res);
}

export async function adminGetProducts() {
  const res = await fetch(`${API_URL}/admin/products`, {
    method: "GET",
    headers: getHeaders(),
  });
  return await handleResponse(res);
}

export async function adminSetVendorActive(id, is_active) {
  const res = await fetch(`${API_URL}/admin/vendors/${id}/active`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ is_active }),
  });
  await handleResponse(res);
}

export async function adminSetProductAvailable(id, is_available) {
  const res = await fetch(`${API_URL}/admin/products/${id}/available`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ is_available }),
  });
  await handleResponse(res);
}

export async function adminSetUserAdmin(id, is_admin) {
  const res = await fetch(`${API_URL}/admin/users/${id}/admin`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ is_admin }),
  });
  await handleResponse(res);
}

export async function adminDeleteVendor(id) {
  const res = await fetch(`${API_URL}/admin/vendors/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  await handleResponse(res);
}

export async function adminDeleteProduct(id) {
  const res = await fetch(`${API_URL}/admin/products/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  await handleResponse(res);
}

export async function adminDeleteProfile(id) {
  const res = await fetch(`${API_URL}/admin/profiles/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  await handleResponse(res);
}

// ---------- REALTIME ----------
export function subscribeOrders(onChange) {
  // Translate http://.../api into ws://.../realtime
  const wsUrl = API_URL.replace(/^http/, "ws").replace("/api", "/realtime");
  
  let ws;
  let closed = false;

  function connect() {
    if (closed) return;
    
    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onChange(data);
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onclose = () => {
      // Auto-reconnect after 3 seconds if not intentionally closed
      if (!closed) {
        setTimeout(connect, 3000);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket connection error:", err);
      ws.close();
    };
  }

  connect();

  // Return unsubscribe handler to match exact Supabase schema
  return () => {
    closed = true;
    if (ws) ws.close();
  };
}
