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

  CREATE TABLE IF NOT EXISTS payments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id         INTEGER NOT NULL REFERENCES pricing_plans(id),
    plan_slug       TEXT    NOT NULL,
    plan_name       TEXT    NOT NULL,
    amount          REAL    NOT NULL,
    currency        TEXT    NOT NULL DEFAULT 'USD',
    payment_method  TEXT    NOT NULL DEFAULT 'google_pay',
    transaction_id  TEXT    NOT NULL UNIQUE,
    google_pay_token TEXT,
    card_network    TEXT,
    card_last4      TEXT,
    status          TEXT    NOT NULL DEFAULT 'completed',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT    NOT NULL UNIQUE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name     TEXT    NOT NULL,
    user_email    TEXT    NOT NULL,
    subject       TEXT    NOT NULL,
    category      TEXT    NOT NULL DEFAULT 'general',
    priority      TEXT    NOT NULL DEFAULT 'medium',
    status        TEXT    NOT NULL DEFAULT 'open',
    plan_tier     TEXT    NOT NULL DEFAULT 'free',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS support_messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id     INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_role   TEXT    NOT NULL CHECK(sender_role IN ('user', 'admin', 'system')),
    sender_name   TEXT    NOT NULL,
    message       TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS device_registrations (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address         TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    registered_email   TEXT NOT NULL,
    user_agent         TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_verifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL,
    code        TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    verified    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER,
    email              TEXT,
    event_type         TEXT NOT NULL,
    ip_address         TEXT,
    device_fingerprint TEXT,
    details            TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL,
    ip_address  TEXT NOT NULL,
    success     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const userColumns = db.pragma("table_info(users)") as Array<{ name: string }>;
if (!userColumns.some((column) => column.name === "free_ai_videos_used")) {
  db.exec("ALTER TABLE users ADD COLUMN free_ai_videos_used INTEGER NOT NULL DEFAULT 0");
}
if (!userColumns.some((column) => column.name === "google_id")) {
  db.exec("ALTER TABLE users ADD COLUMN google_id TEXT");
}
if (!userColumns.some((column) => column.name === "avatar_url")) {
  db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
}
if (!userColumns.some((column) => column.name === "email_verified")) {
  db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
}
if (!userColumns.some((column) => column.name === "registration_ip")) {
  db.exec("ALTER TABLE users ADD COLUMN registration_ip TEXT");
}
if (!userColumns.some((column) => column.name === "registration_device_id")) {
  db.exec("ALTER TABLE users ADD COLUMN registration_device_id TEXT");
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
seedPlan.run("Pro",     "pro",     19.99,"USD", 30, 50,        "50 AI auto-edits, 4K export, beat sync, and commercial licensing.");
seedPlan.run("Agency",  "agency",  49.99,"USD", 30, 999999999, "Unlimited AI auto-cuts, priority render farm, and 24/7 dedicated support.");

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
  password?: string;
  role: "user" | "admin";
  created_at: string;
  free_ai_videos_used?: number;
  google_id?: string | null;
  avatar_url?: string | null;
  email_verified?: number;
  registration_ip?: string | null;
  registration_device_id?: string | null;
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

export const getUserByGoogleId = (googleId: string): DBUser | undefined =>
  db.prepare("SELECT * FROM users WHERE google_id = ?").get(googleId) as DBUser | undefined;

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

export interface CreateUserOptions {
  googleId?: string | null;
  avatarUrl?: string | null;
  emailVerified?: number;
  registrationIp?: string | null;
  registrationDeviceId?: string | null;
}

export const createUser = (
  name: string,
  email: string,
  passwordHash: string,
  options: CreateUserOptions = {}
): number => {
  const result = db.prepare(`
    INSERT INTO users (
      name, email, password, google_id, avatar_url, email_verified, registration_ip, registration_device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    email,
    passwordHash,
    options.googleId || null,
    options.avatarUrl || null,
    options.emailVerified ?? 0,
    options.registrationIp || null,
    options.registrationDeviceId || null
  );

  const userId = result.lastInsertRowid as number;

  const freePlan = db.prepare("SELECT id FROM pricing_plans WHERE slug = 'free' LIMIT 1").get() as { id: number };
  db.prepare(
    "INSERT INTO user_subscriptions (user_id, plan_id) VALUES (?, ?)"
  ).run(userId, freePlan.id);

  if (options.registrationIp && options.registrationDeviceId) {
    recordDeviceRegistration(userId, options.registrationIp, options.registrationDeviceId, email);
  }

  return userId;
};

export const linkGoogleAccount = (userId: number, googleId: string, avatarUrl?: string) => {
  if (avatarUrl) {
    db.prepare("UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?), email_verified = 1 WHERE id = ?")
      .run(googleId, avatarUrl, userId);
  } else {
    db.prepare("UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?")
      .run(googleId, userId);
  }
};

// ── Multi-Account & Device Registration Restrictions ──

export interface DeviceCheckResult {
  isBlocked: boolean;
  reason?: string;
  existingUserId?: number;
  registeredEmail?: string;
}

/**
 * Checks if this device fingerprint or IP address has already registered an account.
 * Restricts multiple registrations to prevent automated bot signups and trial abuse.
 */
export const checkDeviceOrIpRegistration = (
  ipAddress: string,
  deviceFingerprint: string
): DeviceCheckResult => {
  // 1. Check device fingerprint (strictly 1 account per device)
  if (deviceFingerprint && deviceFingerprint !== "server_env") {
    const existingDevice = db.prepare(`
      SELECT user_id, registered_email, created_at
      FROM device_registrations
      WHERE device_fingerprint = ?
      ORDER BY id ASC
      LIMIT 1
    `).get(deviceFingerprint) as { user_id: number; registered_email: string; created_at: string } | undefined;

    if (existingDevice) {
      const maskedEmail = existingDevice.registered_email.replace(
        /(.{2})(.*)(@.*)/,
        "$1***$3"
      );
      return {
        isBlocked: true,
        reason: `An account (${maskedEmail}) has already been registered on this device. AutoCut AI restricts registration to 1 account per device to ensure fair system capacity and prevent trial abuse. Please sign in to your existing account.`,
        existingUserId: existingDevice.user_id,
        registeredEmail: existingDevice.registered_email,
      };
    }
  }

  // 2. Check IP Address registration count (allow up to 2 accounts per public/home IP; ignore loopback/localhost)
  const isLocalhost = ipAddress === "127.0.0.1" || ipAddress === "::1" || ipAddress === "localhost";
  if (!isLocalhost && ipAddress) {
    const ipCount = (
      db.prepare(`
        SELECT COUNT(DISTINCT registered_email) as count
        FROM device_registrations
        WHERE ip_address = ?
      `).get(ipAddress) as { count: number }
    ).count;

    // Strict multi-account threshold per IP
    if (ipCount >= 2) {
      return {
        isBlocked: true,
        reason: `Registration limit reached for this network address (${ipAddress}). Multiple accounts from the same IP address are restricted to protect platform resources. Please sign in to your existing account.`,
      };
    }
  }

  return { isBlocked: false };
};

export const recordDeviceRegistration = (
  userId: number,
  ipAddress: string,
  deviceFingerprint: string,
  registeredEmail: string,
  userAgent?: string
) => {
  db.prepare(`
    INSERT INTO device_registrations (user_id, ip_address, device_fingerprint, registered_email, user_agent)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, ipAddress, deviceFingerprint, registeredEmail, userAgent || "");
};

// ── Email Verification Codes ──

export const saveEmailVerificationCode = (email: string, code: string, durationMinutes = 15) => {
  // Invalidate previous unverified codes for this email
  db.prepare("DELETE FROM email_verifications WHERE email = ?").run(email.toLowerCase());
  
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO email_verifications (email, code, expires_at)
    VALUES (?, ?, ?)
  `).run(email.toLowerCase(), code, expiresAt);
};

export const verifyEmailCode = (email: string, code: string): boolean => {
  const row = db.prepare(`
    SELECT id, expires_at, verified
    FROM email_verifications
    WHERE email = ? AND code = ? AND verified = 0
    ORDER BY id DESC
    LIMIT 1
  `).get(email.toLowerCase(), code.trim()) as { id: number; expires_at: string; verified: number } | undefined;

  if (!row) return false;

  const isExpired = new Date(row.expires_at).getTime() < Date.now();
  if (isExpired) return false;

  db.prepare("UPDATE email_verifications SET verified = 1 WHERE id = ?").run(row.id);
  db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run(email.toLowerCase());
  return true;
};

// ── Security & Login Attempt Auditing ──

export const recordAuthAudit = (
  eventType: string,
  data: {
    userId?: number;
    email?: string;
    ipAddress?: string;
    deviceFingerprint?: string;
    details?: string;
  }
) => {
  try {
    db.prepare(`
      INSERT INTO auth_audit_logs (user_id, email, event_type, ip_address, device_fingerprint, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.userId || null,
      data.email || "",
      eventType,
      data.ipAddress || "",
      data.deviceFingerprint || "",
      data.details || ""
    );
  } catch (e) {
    console.error("[AuthAudit] Error:", e);
  }
};

export const getRecentFailedLogins = (email: string, ipAddress: string, windowMinutes = 15): number => {
  const windowTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const row = db.prepare(`
    SELECT COUNT(*) as count
    FROM login_attempts
    WHERE (email = ? OR ip_address = ?)
      AND success = 0
      AND created_at >= ?
  `).get(email.toLowerCase(), ipAddress, windowTime) as { count: number };
  return row ? row.count : 0;
};

export const recordLoginAttempt = (email: string, ipAddress: string, success: boolean) => {
  db.prepare(`
    INSERT INTO login_attempts (email, ip_address, success)
    VALUES (?, ?, ?)
  `).run(email.toLowerCase(), ipAddress, success ? 1 : 0);
};

export const getUserWithSubscription = (userId: number): UserWithSubscription | undefined => {
  const row = db.prepare(`
    SELECT u.*, pp.slug AS plan_slug, pp.name AS plan_name, pp.price AS plan_price,
           pp.currency AS plan_currency, pp.ai_video_limit,
           CASE WHEN pp.slug = 'free' THEN u.free_ai_videos_used ELSE us.ai_videos_used END AS ai_videos_used,
           us.id AS subscription_id, us.expires_at, us.is_active
    FROM users u
    LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.is_active = 1
    LEFT JOIN pricing_plans pp ON pp.id = us.plan_id
    WHERE u.id = ?
  `).get(userId) as (UserWithSubscription & { is_active?: number }) | undefined;

  if (!row) return undefined;

  // If user has no active subscription row, auto-provision default free plan
  if (!row.plan_slug) {
    const freePlan = db.prepare("SELECT id FROM pricing_plans WHERE slug = 'free' LIMIT 1").get() as { id: number } | undefined;
    if (freePlan) {
      db.prepare("INSERT INTO user_subscriptions (user_id, plan_id, ai_videos_used, is_active) VALUES (?, ?, 0, 1)").run(userId, freePlan.id);
      return getUserWithSubscription(userId);
    }
  }

  // Check if paid subscription has expired
  if (row.expires_at && row.plan_slug !== "free") {
    const isExpired = new Date(row.expires_at).getTime() < Date.now();
    if (isExpired) {
      // Deactivate expired subscription and assign free plan
      db.transaction(() => {
        db.prepare("UPDATE user_subscriptions SET is_active = 0 WHERE id = ?").run(row.subscription_id);
        const freePlan = db.prepare("SELECT id FROM pricing_plans WHERE slug = 'free' LIMIT 1").get() as { id: number };
        db.prepare("INSERT INTO user_subscriptions (user_id, plan_id, ai_videos_used, is_active) VALUES (?, ?, 0, 1)").run(userId, freePlan.id);
      })();
      return getUserWithSubscription(userId);
    }
  }

  return row;
};

export const updateUserRole = (userId: number, role: "user" | "admin") =>
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);

export const deleteUser = (userId: number) =>
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);

// ── Subscriptions ──────────────────────

export const consumeAiVideoUsage = (userId: number): boolean => db.transaction(() => {
  let userSub = getUserWithSubscription(userId);
  if (!userSub) return false;

  // Agency plan has unlimited edits
  if (userSub.plan_slug === "agency" || (userSub.ai_video_limit && userSub.ai_video_limit >= 9999)) {
    if (userSub.subscription_id) {
      db.prepare("UPDATE user_subscriptions SET ai_videos_used = ai_videos_used + 1 WHERE id = ?").run(userSub.subscription_id);
    }
    return true;
  }

  // Free plan limit check
  if (userSub.plan_slug === "free") {
    const limit = userSub.ai_video_limit || 2;
    const result = db.prepare(`
      UPDATE users
      SET free_ai_videos_used = free_ai_videos_used + 1
      WHERE id = ? AND free_ai_videos_used < ?
    `).run(userId, limit);

    if (result.changes === 0) return false;

    if (userSub.subscription_id) {
      db.prepare("UPDATE user_subscriptions SET ai_videos_used = ai_videos_used + 1 WHERE id = ?").run(userSub.subscription_id);
    }
    return true;
  }

  // Paid tier limit check
  const paidLimit = userSub.ai_video_limit || 50;
  if ((userSub.ai_videos_used || 0) >= paidLimit) {
    return false;
  }

  if (userSub.subscription_id) {
    db.prepare("UPDATE user_subscriptions SET ai_videos_used = ai_videos_used + 1 WHERE id = ?").run(userSub.subscription_id);
  }
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

// ── Google Pay & Payments ─────────────

export interface DBPayment {
  id: number;
  user_id: number;
  plan_id: number;
  plan_slug: string;
  plan_name: string;
  amount: number;
  currency: string;
  payment_method: string;
  transaction_id: string;
  google_pay_token?: string;
  card_network?: string;
  card_last4?: string;
  status: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export const recordPayment = (data: {
  userId: number;
  planId: number;
  planSlug: string;
  planName: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  transactionId: string;
  googlePayToken?: string;
  cardNetwork?: string;
  cardLast4?: string;
  status?: string;
  expiresAt: string | null;
}): DBPayment => {
  return db.transaction(() => {
    db.prepare(`
      INSERT INTO payments (
        user_id, plan_id, plan_slug, plan_name, amount, currency,
        payment_method, transaction_id, google_pay_token, card_network, card_last4, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.userId,
      data.planId,
      data.planSlug,
      data.planName,
      data.amount,
      data.currency || 'USD',
      data.paymentMethod || 'google_pay',
      data.transactionId,
      data.googlePayToken || null,
      data.cardNetwork || 'VISA',
      data.cardLast4 || '4242',
      data.status || 'completed'
    );

    upgradeUserPlan(data.userId, data.planSlug, data.expiresAt);

    return db.prepare("SELECT * FROM payments WHERE transaction_id = ?").get(data.transactionId) as DBPayment;
  })();
};

export const getUserPayments = (userId: number): DBPayment[] =>
  db.prepare(`
    SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId) as DBPayment[];

export const getAllPayments = (): DBPayment[] =>
  db.prepare(`
    SELECT p.*, u.name AS user_name, u.email AS user_email
    FROM payments p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
  `).all() as DBPayment[];

export const getPaymentStats = () => {
  const totalRevenue = (db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'completed'").get() as { total: number }).total;
  const totalTransactions = (db.prepare("SELECT COUNT(*) AS count FROM payments WHERE status = 'completed'").get() as { count: number }).count;
  const recentPayments = db.prepare(`
    SELECT p.*, u.name AS user_name, u.email AS user_email
    FROM payments p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC LIMIT 15
  `).all() as DBPayment[];
  return { totalRevenue, totalTransactions, recentPayments };
};

// ── Support Tickets & Messages ────────

export interface DBSupportTicket {
  id: number;
  ticket_number: string;
  user_id: number;
  user_name: string;
  user_email: string;
  subject: string;
  category: string;
  priority: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  plan_tier: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string;
}

export interface DBSupportMessage {
  id: number;
  ticket_id: number;
  sender_role: "user" | "admin" | "system";
  sender_name: string;
  message: string;
  created_at: string;
}

export const createSupportTicket = (data: {
  userId: number;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  priority?: string;
  planTier?: string;
  initialMessage: string;
}): { ticket: DBSupportTicket; message: DBSupportMessage } => {
  return db.transaction(() => {
    const ticketNumber = `TICK-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const insertTicket = db.prepare(`
      INSERT INTO support_tickets (
        ticket_number, user_id, user_name, user_email, subject, category, priority, status, plan_tier
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `).run(
      ticketNumber,
      data.userId,
      data.userName,
      data.userEmail,
      data.subject,
      data.category || 'general',
      data.priority || 'medium',
      data.planTier || 'free'
    );

    const ticketId = insertTicket.lastInsertRowid as number;

    const insertMsg = db.prepare(`
      INSERT INTO support_messages (ticket_id, sender_role, sender_name, message)
      VALUES (?, 'user', ?, ?)
    `).run(ticketId, data.userName, data.initialMessage);

    const systemAck = data.category === 'billing'
      ? `Hello ${data.userName}, thank you for contacting Billing & Google Pay Support. Your ticket ${ticketNumber} has been logged in our priority payment queue. An agent will verify your transaction details and reply here shortly.`
      : `Hello ${data.userName}, thank you for contacting AutoCut AI Customer Support. Your inquiry ${ticketNumber} has been received by our technical desk. We typically review and respond within 1-2 hours.`;

    db.prepare(`
      INSERT INTO support_messages (ticket_id, sender_role, sender_name, message)
      VALUES (?, 'system', 'AutoCut Support Bot', ?)
    `).run(ticketId, systemAck);

    const ticket = db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(ticketId) as DBSupportTicket;
    const message = db.prepare("SELECT * FROM support_messages WHERE id = ?").get(insertMsg.lastInsertRowid) as DBSupportMessage;

    return { ticket, message };
  })();
};

export const getUserTickets = (userId: number): DBSupportTicket[] =>
  db.prepare(`
    SELECT st.*, COUNT(sm.id) AS message_count
    FROM support_tickets st
    LEFT JOIN support_messages sm ON sm.ticket_id = st.id
    WHERE st.user_id = ?
    GROUP BY st.id
    ORDER BY st.updated_at DESC
  `).all(userId) as DBSupportTicket[];

export const getTicketById = (ticketId: number): DBSupportTicket | undefined =>
  db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(ticketId) as DBSupportTicket | undefined;

export const getTicketMessages = (ticketId: number): DBSupportMessage[] =>
  db.prepare("SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC").all(ticketId) as DBSupportMessage[];

export const addTicketMessage = (data: {
  ticketId: number;
  senderRole: "user" | "admin" | "system";
  senderName: string;
  message: string;
}): DBSupportMessage => {
  return db.transaction(() => {
    const insert = db.prepare(`
      INSERT INTO support_messages (ticket_id, sender_role, sender_name, message)
      VALUES (?, ?, ?, ?)
    `).run(data.ticketId, data.senderRole, data.senderName, data.message);

    // Update ticket updated_at and status if admin replied
    if (data.senderRole === 'admin') {
      db.prepare(`
        UPDATE support_tickets
        SET updated_at = datetime('now'), status = CASE WHEN status = 'resolved' THEN 'in_progress' ELSE status END
        WHERE id = ?
      `).run(data.ticketId);
    } else {
      db.prepare(`UPDATE support_tickets SET updated_at = datetime('now') WHERE id = ?`).run(data.ticketId);
    }

    return db.prepare("SELECT * FROM support_messages WHERE id = ?").get(insert.lastInsertRowid) as DBSupportMessage;
  })();
};

export const updateTicketStatus = (ticketId: number, status: string, priority?: string) => {
  if (priority) {
    db.prepare(`
      UPDATE support_tickets
      SET status = ?, priority = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, priority, ticketId);
  } else {
    db.prepare(`
      UPDATE support_tickets
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, ticketId);
  }
};

export const getAllSupportTickets = (filterStatus?: string): DBSupportTicket[] => {
  if (filterStatus && filterStatus !== 'all') {
    return db.prepare(`
      SELECT st.*, COUNT(sm.id) AS message_count
      FROM support_tickets st
      LEFT JOIN support_messages sm ON sm.ticket_id = st.id
      WHERE st.status = ?
      GROUP BY st.id
      ORDER BY st.updated_at DESC
    `).all(filterStatus) as DBSupportTicket[];
  }
  return db.prepare(`
    SELECT st.*, COUNT(sm.id) AS message_count
    FROM support_tickets st
    LEFT JOIN support_messages sm ON sm.ticket_id = st.id
    GROUP BY st.id
    ORDER BY st.updated_at DESC
  `).all() as DBSupportTicket[];
};

export const getSupportStats = () => {
  const total = (db.prepare("SELECT COUNT(*) as count FROM support_tickets").get() as { count: number }).count;
  const open = (db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'open'").get() as { count: number }).count;
  const inProgress = (db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'in_progress'").get() as { count: number }).count;
  const resolved = (db.prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status IN ('resolved', 'closed')").get() as { count: number }).count;
  return { total, open, inProgress, resolved };
};

export default db;
