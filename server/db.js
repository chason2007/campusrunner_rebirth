import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

// Parse connection URL to decide if we should enable SSL (required for Supabase pooler connection)
const hasSsl = connectionString && (connectionString.includes("supabase.com") || connectionString.includes("supabase.co") || connectionString.includes("sslmode=require"));

export const pool = new Pool({
  connectionString,
  ssl: hasSsl ? { rejectUnauthorized: false } : false,
});

export function query(text, params) {
  return pool.query(text, params);
}
