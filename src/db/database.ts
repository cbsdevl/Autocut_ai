import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

// Store DB in project root under /data folder
const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "autocut.db");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─────────────────────────────────────────
// Schema Setup
// ─────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    free_ai_videos_used INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pricing_plans (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL UNIQUE,
    slug            TEXT    NOT NULL UNIQUE,
    price           REAL    NOT NULL DEFAULT 0,
    currency        TEXT    NOT NULL DEFAULT 'USD',
    duration_days   INTEGER NOT NULL DEFAULT 0,
    ai_video_limit  INTEGER NOT NULL DEFAULT 2,
    is_active       INTEGER NOT NULL DEFAULT 1,
    description     TEXT    NOT NULL DEFAULT '',
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_subscriptions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id         INTEGER NOT NULL REFERENCES pricing_plans(id),
    started_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at      TEXT,
    ai_videos_used  INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1
  );
`);

const userColumns = db.pragma("table_info(users)") as Array<{ name: string }>;
if (!userColumns.some((column) => column.name === "free_ai_videos_used")) {
  db.exec("ALTER TABLE users ADD COLUMN free_ai_videos_used INTEGER NOT NULL DEFAULT 0");
}

db.exec(`
  UPDATE users
  SET free_ai_videos_used = MAX(
    free_ai_videos_used,
    COALESCE((
      SELECT MAX(us.ai_videos_used)
      FROM user_subscriptions us
      JOIN pricing_plans pp ON pp.id = us.plan_id
      WHERE us.user_id = users.id AND pp.slug = 'free'
    ), 0)
  )
`);

// ─────────────────────────────────────────
// Seed Default Pricing Plans
// ─────────────────────────────────────────

const seedPlan = db.prepare(`
  INSERT OR IGNORE INTO pricing_plans (name, slug, price, currency, duration_days, ai_video_limit, description)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

seedPlan.run("Free",    "free",    0,    "USD", 0,  2,         "Get started for free. 2 AI auto-video generations. Unlimited editing.");
seedPlan.run("Weekly",  "weekly",  9.99, "USD", 7,  999999999, "All features unlocked. Billed weekly.");
seedPlan.run("Monthly", "monthly", 24.99,"USD", 30, 999999999, "Best value. All features unlocked. Billed monthly.");

// ─────────────────────────────────────────
// Seed Default Admin Account (first run only)
// ─────────────────────────────────────────

const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
if (!existingAdmin) {
  const hash = bcrypt.hashSync("admin123", 10);
  const result = db.prepare(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
  ).run("Admin", "admin@autocut.ai", hash, "admin");

  const freePlan = db.prepare("SELECT id FROM pricing_plans WHERE slug = 'free' LIMIT 1").get() as { id: number };
  db.prepare(
    "INSERT INTO user_subscriptions (user_id, plan_id, ai_videos_used) VALUES (?, ?, 0)"
  ).run(result.lastInsertRowid, freePlan.id);

  console.log("[AutoCut DB] Default admin created: admin@autocut.ai / admin123");
}

// ─────────────────────────────────────────
// Typed Query Helpers
// ─────────────────────────────────────────

export interface DBUser {
  id: number;
  name: string;
  email: string;
  password: string;
  role: "user" | "admin";
  created_at: string;
}

export interface DBPricingPlan {
  id: number;
  name: string;
  slug: string;
  price: number;
  currency: string;
  duration_days: number;
  ai_video_limit: number;
  is_active: number;
  description: string;
  updated_at: string;
}

export interface DBSubscription {
  id: number;
  user_id: number;
  plan_id: number;
  started_at: string;
  expires_at: string | null;
  ai_videos_used: number;
  is_active: number;
}

export interface UserWithSubscription extends DBUser {
  plan_slug: string;
  plan_name: string;
  plan_price: number;
  plan_currency: string;
  ai_video_limit: number;
  ai_videos_used: number;
  subscription_id: number;
  expires_at: string | null;
}

// ── Users ──────────────────────────────

export const getUserByEmail = (email: string): DBUser | undefined =>
  db.prepare("SELECT * FROM users WHERE email = ?").get(email) as DBUser | undefined;

export const getUserById = (id: number): DBUser | undefined =>
  db.prepare("SELECT * FROM users WHERE id = ?").get(id) as DBUser | undefined;

export const getAllUsers = (): UserWithSubscription[] =>
  db.prepare(`
    SELECT u.*, pp.slug AS plan_slug, pp.name AS plan_name, pp.price AS plan_price,
           pp.currency AS plan_currency, pp.ai_video_limit,
           CASE WHEN pp.slug = 'free' THEN u.free_ai_videos_used ELSE us.ai_videos_used END AS ai_videos_used,
           us.id AS subscription_id, us.expires_at
    FROM users u
    LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.is_active = 1
    LEFT JOIN pricing_plans pp ON pp.id = us.plan_id
    ORDER BY u.created_at DESC
  `).all() as UserWithSubscription[];

export const createUser = (name: string, email: string, passwordHash: string): number => {
  const result = db.prepare(
    "INSERT INTO users (name, email, password) VALUES (?, ?, ?)"
  ).run(name, email, passwordHash);

  const freePlan = db.prepare("SELECT id FROM pricing_plans WHERE slug = 'free' LIMIT 1").get() as { id: number };
  db.prepare(
    "INSERT INTO user_subscriptions (user_id, plan_id) VALUES (?, ?)"
  ).run(result.lastInsertRowid, freePlan.id);

  return result.lastInsertRowid as number;
};

export const getUserWithSubscription = (userId: number): UserWithSubscription | undefined =>
  db.prepare(`
    SELECT u.*, pp.slug AS plan_slug, pp.name AS plan_name, pp.price AS plan_price,
           pp.currency AS plan_currency, pp.ai_video_limit,
           CASE WHEN pp.slug = 'free' THEN u.free_ai_videos_used ELSE us.ai_videos_used END AS ai_videos_used,
           us.id AS subscription_id, us.expires_at
    FROM users u
    LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.is_active = 1
    LEFT JOIN pricing_plans pp ON pp.id = us.plan_id
    WHERE u.id = ?
  `).get(userId) as UserWithSubscription | undefined;

export const updateUserRole = (userId: number, role: "user" | "admin") =>
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);

export const deleteUser = (userId: number) =>
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);

// ── Subscriptions ──────────────────────

export const consumeAiVideoUsage = (userId: number): boolean => db.transaction(() => {
  const subscription = db.prepare(`
    SELECT us.id, pp.slug AS plan_slug, pp.ai_video_limit, u.free_ai_videos_used
    FROM user_subscriptions us
    JOIN pricing_plans pp ON pp.id = us.plan_id
    JOIN users u ON u.id = us.user_id
    WHERE us.user_id = ? AND us.is_active = 1
  `).get(userId) as { id: number; plan_slug: string; ai_video_limit: number; free_ai_videos_used: number } | undefined;

  if (!subscription) return false;
  if (subscription.plan_slug === "free") {
    const result = db.prepare(`
      UPDATE users
      SET free_ai_videos_used = free_ai_videos_used + 1
      WHERE id = ? AND free_ai_videos_used < ?
    `).run(userId, subscription.ai_video_limit);
    if (result.changes === 0) return false;
  }

  db.prepare("UPDATE user_subscriptions SET ai_videos_used = ai_videos_used + 1 WHERE id = ?").run(subscription.id);
  return true;
})();

export const upgradeUserPlan = (userId: number, planSlug: string, expiresAt: string | null) => {
  const plan = db.prepare("SELECT id FROM pricing_plans WHERE slug = ?").get(planSlug) as { id: number } | undefined;
  if (!plan) throw new Error("Plan not found");

  db.transaction(() => {
    db.prepare("UPDATE user_subscriptions SET is_active = 0 WHERE user_id = ?").run(userId);
    const freeUsage = planSlug === "free"
      ? (db.prepare("SELECT free_ai_videos_used AS used FROM users WHERE id = ?").get(userId) as { used: number } | undefined)?.used ?? 0
      : 0;
    db.prepare(
      "INSERT INTO user_subscriptions (user_id, plan_id, expires_at, ai_videos_used) VALUES (?, ?, ?, ?)"
    ).run(userId, plan.id, expiresAt, freeUsage);
  })();
};

// ── Pricing Plans ──────────────────────

export const getAllPlans = (): DBPricingPlan[] =>
  db.prepare("SELECT * FROM pricing_plans WHERE is_active = 1 ORDER BY price ASC").all() as DBPricingPlan[];

export const updatePlan = (id: number, updates: Partial<Pick<DBPricingPlan, "price" | "currency" | "ai_video_limit" | "description" | "name">>) => {
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(", ");
  const values = [...Object.values(updates), id];
  db.prepare(`UPDATE pricing_plans SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values);
};

export default db;
