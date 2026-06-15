import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("Initializing database...");
  try {
    // 1. Run Schema
    const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await pool.query(schemaSql);
    console.log("✔ Schema applied successfully.");

    // 2. Run Seeds
    const seedSql = fs.readFileSync(path.join(__dirname, "../supabase/seed.sql"), "utf8");
    await pool.query(seedSql);
    console.log("✔ Base catalog seeds applied successfully.");

    // 3. Create Default Users (Admin, Buyer, Runner)
    const adminPasswordHash = await bcrypt.hash("admin123", 10);
    const buyerPasswordHash = await bcrypt.hash("buyer123", 10);
    const runnerPasswordHash = await bcrypt.hash("runner123", 10);

    // Seed Admin (Global superadmin)
    await pool.query(
      `INSERT INTO public.profiles (email, password_hash, full_name, wallet_paise, is_admin, is_verified) 
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING`,
      ["admin@camprunner.com", adminPasswordHash, "Super Admin", 1000000, true, true]
    );

    // Seed IITB Buyer
    await pool.query(
      `INSERT INTO public.profiles (email, password_hash, full_name, wallet_paise, is_admin, is_verified, university_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (email) DO NOTHING`,
      ["buyer@iitb.ac.in", buyerPasswordHash, "IITB Student Buyer", 25000, false, true, "10000000-1000-1000-1000-100000000000"]
    );

    // Seed IITB Runner
    await pool.query(
      `INSERT INTO public.profiles (email, password_hash, full_name, wallet_paise, is_admin, is_verified, university_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (email) DO NOTHING`,
      ["runner@iitb.ac.in", runnerPasswordHash, "IITB Student Runner", 10000, false, true, "10000000-1000-1000-1000-100000000000"]
    );

    // Seed MIT Buyer
    await pool.query(
      `INSERT INTO public.profiles (email, password_hash, full_name, wallet_paise, is_admin, is_verified, university_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (email) DO NOTHING`,
      ["buyer@mit.edu", buyerPasswordHash, "MIT Student Buyer", 50000, false, true, "20000000-2000-2000-2000-200000000000"]
    );

    console.log("✔ Default test users seeded successfully:");
    console.log("   - Admin: admin@camprunner.com / admin123");
    console.log("   - IITB Buyer: buyer@iitb.ac.in / buyer123");
    console.log("   - IITB Runner: runner@iitb.ac.in / runner123");
    console.log("   - MIT Buyer: buyer@mit.edu / buyer123");

    process.exit(0);
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  }
}

run();
