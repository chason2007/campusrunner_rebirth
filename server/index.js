import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { WebSocketServer } from "ws";
import http from "http";
import dotenv from "dotenv";
import { query } from "./db.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "campus_runner_super_secure_jwt_secret_key_123!";

// Enable CORS for frontend requests
app.use(cors());
app.use(express.json());

// WebSocket server setup for Realtime notifications
const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

// Upgrade HTTP request to WebSocket for /realtime endpoint
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === "/realtime") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Helper to broadcast changes to all clients
function broadcastUpdate(payload) {
  const msg = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(msg);
    }
  }
}

// ---------- MIDDLEWARE ----------

// Authenticate JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });
}

// Require Admin (Validates from DB directly for security)
async function requireAdmin(req, res, next) {
  try {
    const { rows } = await query("SELECT is_admin FROM public.profiles WHERE id = $1", [req.user.id]);
    if (rows.length === 0 || !rows[0].is_admin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: "Internal server verification error" });
  }
}

// ---------- ROUTES ----------

// 1. AUTHENTICATION

// Sign Up
app.post("/api/auth/signup", async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Check if user already exists
    const existing = await query("SELECT id FROM public.profiles WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Account already exists with this email" });
    }

    // Resolve university by domain
    const emailDomain = email.split("@")[1];
    const uniRes = await query("SELECT id FROM public.universities WHERE domain = $1", [emailDomain]);
    const universityId = uniRes.rows.length > 0 ? uniRes.rows[0].id : null;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user profile
    const profileRes = await query(
      `INSERT INTO public.profiles (email, password_hash, full_name, university_id, wallet_paise)
       VALUES ($1, $2, $3, $4, 24000) RETURNING id, email, full_name, is_admin, university_id`,
      [email, passwordHash, fullName || null, universityId]
    );
    const user = profileRes.rows[0];

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email, university_id: user.university_id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({ token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// Sign In
app.post("/api/auth/signin", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const { rows } = await query("SELECT * FROM public.profiles WHERE email = $1", [email]);
    if (rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email, university_id: user.university_id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    // Strip password hash from response
    delete user.password_hash;

    res.json({ token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Sign in failed" });
  }
});

// Get Current User Profile
app.get("/api/auth/profile", authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.email, p.full_name, p.is_verified, p.wallet_paise, p.rating_sum, p.rating_count, p.is_admin, p.created_at,
              u.id as "uni_id", u.name as "uni_name", u.domain as "uni_domain", u.colors as "uni_colors", u.locations as "uni_locations"
       FROM public.profiles p
       LEFT JOIN public.universities u ON p.university_id = u.id
       WHERE p.id = $1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const row = rows[0];
    const user = {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      is_verified: row.is_verified,
      wallet_paise: row.wallet_paise,
      rating_sum: row.rating_sum,
      rating_count: row.rating_count,
      is_admin: row.is_admin,
      created_at: row.created_at,
      university: row.uni_id ? {
        id: row.uni_id,
        name: row.uni_name,
        domain: row.uni_domain,
        colors: row.uni_colors,
        locations: row.uni_locations
      } : null
    };

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});


// 2. CATALOG (Filtered by University)

// Get Vendors
app.get("/api/vendors", authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT * FROM public.vendors WHERE university_id = $1 AND is_active = true ORDER BY name",
      [req.user.university_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
});

// Get Products
app.get("/api/products", authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT * FROM public.products WHERE university_id = $1 AND is_available = true ORDER BY name",
      [req.user.university_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});


// 3. ORDERS (Buyer + Runner logic)

// Place Order
app.post("/api/orders/place", authenticateToken, async (req, res) => {
  const { vendorId, isCustom, customTitle, customDetails, drop, items, payment, surgeFee } = req.body;

  try {
    const { rows } = await query(
      "SELECT public.place_order($1, $2, $3, $4, $5, $6, $7, $8, $9) as order_id",
      [
        req.user.id,
        vendorId || null,
        isCustom,
        customTitle || null,
        customDetails || null,
        drop,
        JSON.stringify(items),
        payment,
        surgeFee || 0
      ]
    );

    const orderId = rows[0].order_id;
    broadcastUpdate({ event: "INSERT", table: "orders", record: { id: orderId } });
    res.status(201).json({ orderId });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Failed to place order" });
  }
});

// Get My Orders (Buyer history)
app.get("/api/orders/my-orders", authenticateToken, async (req, res) => {
  try {
    const orderRows = await query(
      `SELECT o.*, 
              (SELECT json_agg(oi.*) FROM public.order_items oi WHERE oi.order_id = o.id) as order_items,
              p.full_name as runner_name, p.rating_sum as runner_rating_sum, p.rating_count as runner_rating_count
       FROM public.orders o
       LEFT JOIN public.profiles p ON o.runner_id = p.id
       WHERE o.buyer_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(orderRows.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Get My Runs (Runner history)
app.get("/api/orders/my-runs", authenticateToken, async (req, res) => {
  try {
    const orderRows = await query(
      `SELECT o.*, v.name as vendor_name, v.emoji as vendor_emoji,
              (SELECT json_agg(oi.*) FROM public.order_items oi WHERE oi.order_id = o.id) as order_items
       FROM public.orders o
       LEFT JOIN public.vendors v ON o.vendor_id = v.id
       WHERE o.runner_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(orderRows.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch runs" });
  }
});

// Get Open Feed (Runners finding new orders in their university)
app.get("/api/orders/open-feed", authenticateToken, async (req, res) => {
  try {
    const orderRows = await query(
      `SELECT o.*, v.name as vendor_name, v.emoji as vendor_emoji,
              (SELECT json_agg(oi.*) FROM public.order_items oi WHERE oi.order_id = o.id) as order_items
       FROM public.orders o
       LEFT JOIN public.vendors v ON o.vendor_id = v.id
       WHERE o.status = 'PLACED' AND o.university_id = $1 AND o.buyer_id <> $2
       ORDER BY o.created_at ASC`,
      [req.user.university_id, req.user.id]
    );
    res.json(orderRows.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order feed" });
  }
});

// Accept Order
app.post("/api/orders/:id/accept", authenticateToken, async (req, res) => {
  try {
    await query("SELECT public.accept_order($1, $2)", [req.user.id, req.params.id]);
    broadcastUpdate({ event: "UPDATE", table: "orders", record: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to accept order" });
  }
});

// Advance Order Status
app.post("/api/orders/:id/advance", authenticateToken, async (req, res) => {
  const { toStatus } = req.body;
  try {
    await query("SELECT public.advance_order($1, $2, $3)", [req.user.id, req.params.id, toStatus]);
    broadcastUpdate({ event: "UPDATE", table: "orders", record: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to advance order" });
  }
});

// Confirm Receipt & Rate
app.post("/api/orders/:id/confirm", authenticateToken, async (req, res) => {
  const { rating } = req.body;
  try {
    await query("SELECT public.confirm_order($1, $2, $3)", [req.user.id, req.params.id, rating]);
    broadcastUpdate({ event: "UPDATE", table: "orders", record: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to confirm order" });
  }
});

// Toggle Item Collected
app.post("/api/orders/item/:itemId/collected", authenticateToken, async (req, res) => {
  const { collected } = req.body;
  try {
    await query("SELECT public.set_item_collected($1, $2, $3)", [req.user.id, req.params.itemId, collected]);
    broadcastUpdate({ event: "UPDATE", table: "order_items", record: { id: req.params.itemId } });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message || "Failed to toggle item" });
  }
});


// 4. ADMIN DASHBOARD ROUTINGS

// Get all orders globally
app.get("/api/admin/orders", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT o.*, 
              (SELECT json_agg(oi.*) FROM public.order_items oi WHERE oi.order_id = o.id) as order_items,
              b.full_name as buyer_name,
              r.full_name as runner_name,
              v.name as vendor_name
       FROM public.orders o
       LEFT JOIN public.profiles b ON o.buyer_id = b.id
       LEFT JOIN public.profiles r ON o.runner_id = r.id
       LEFT JOIN public.vendors v ON o.vendor_id = v.id
       ORDER BY o.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin orders" });
  }
});

// Get all profiles
app.get("/api/admin/profiles", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query("SELECT id, email, full_name, is_verified, wallet_paise, rating_sum, rating_count, is_admin, university_id, created_at FROM public.profiles ORDER BY created_at DESC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user profiles" });
  }
});

// Get all vendors
app.get("/api/admin/vendors", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM public.vendors ORDER BY name");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin vendors" });
  }
});

// Get all products
app.get("/api/admin/products", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, v.name as vendor_name 
       FROM public.products p
       LEFT JOIN public.vendors v ON p.vendor_id = v.id
       ORDER BY p.name`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin products" });
  }
});

// Toggle vendor active status
app.post("/api/admin/vendors/:id/active", authenticateToken, requireAdmin, async (req, res) => {
  const { is_active } = req.body;
  try {
    await query("UPDATE public.vendors SET is_active = $1 WHERE id = $2", [is_active, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update vendor status" });
  }
});

// Toggle product available status
app.post("/api/admin/products/:id/available", authenticateToken, requireAdmin, async (req, res) => {
  const { is_available } = req.body;
  try {
    await query("UPDATE public.products SET is_available = $1 WHERE id = $2", [is_available, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update product availability" });
  }
});

// Grant or revoke admin rights
app.post("/api/admin/users/:id/admin", authenticateToken, requireAdmin, async (req, res) => {
  const { is_admin } = req.body;
  try {
    await query("UPDATE public.profiles SET is_admin = $1 WHERE id = $2", [is_admin, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update user admin status" });
  }
});

// Delete a vendor
app.delete("/api/admin/vendors/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM public.vendors WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete vendor" });
  }
});

// Delete a product
app.delete("/api/admin/products/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM public.products WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Delete a user profile
app.delete("/api/admin/profiles/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM public.profiles WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete profile" });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start the server
server.listen(PORT, () => {
  console.log(`🚀 Campus Runner backend listening at http://localhost:${PORT}`);
});
