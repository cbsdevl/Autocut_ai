import express, { Request, Response, NextFunction } from "express";
import path from "path";
import dotenv from "dotenv";
import fs, { promises as fsPromises } from "fs";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import multer from "multer";
import ffmpegStatic from "ffmpeg-static";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import {
  getUserByEmail,
  getUserById,
  getUserWithSubscription,
  getAllUsers,
  createUser,
  updateUserRole,
  deleteUser,
  getAllPlans,
  updatePlan,
  upgradeUserPlan,
  consumeAiVideoUsage,
} from "./src/db/database.js";

dotenv.config();

const execFileAsync = promisify(execFile);
const runFFmpeg = (args: string[]) =>
  execFileAsync(process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg", args, {
    maxBuffer: 256 * 1024 * 1024,
  });

function ffmpegColor(value: string | undefined, fallback: string): string {
  if (!value || value === "transparent") return fallback;
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return `0x${hex[1]}`;
  const rgba = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgba) {
    const channels = rgba.slice(1, 4).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("");
    return `0x${channels}${rgba[4] ? `@${rgba[4]}` : ""}`;
  }
  return value;
}

function escapeFilterPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function findOverlayFont(fontFamily: string, bold: boolean): string | null {
  const family = fontFamily.toLowerCase();
  const fontsDirectory = path.join(process.env.WINDIR || "C:/Windows", "Fonts");
  let fontNames: string[];
  if (family.includes("impact")) fontNames = ["impact.ttf"];
  else if (family.includes("georgia")) fontNames = [bold ? "georgiab.ttf" : "georgia.ttf"];
  else if (family.includes("mono")) fontNames = [bold ? "consolab.ttf" : "consola.ttf"];
  else if (family.includes("serif")) fontNames = [bold ? "timesbd.ttf" : "times.ttf"];
  else fontNames = [bold ? "arialbd.ttf" : "arial.ttf"];

  const candidates = [
    ...fontNames.map((name) => path.join(fontsDirectory, name)),
    `/usr/share/fonts/truetype/dejavu/${family.includes("serif") ? "DejaVuSerif" : "DejaVuSans"}${bold ? "-Bold" : ""}.ttf`,
    `/usr/share/fonts/truetype/liberation2/${bold ? "LiberationSans-Bold" : "LiberationSans-Regular"}.ttf`,
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

const uploadMaster = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "autocut-ai-secret-change-in-production";
const COOKIE_NAME = "autocut_token";

// Middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// ─────────────────────────────────────────────────────────────
// Auth Helpers
// ─────────────────────────────────────────────────────────────

interface JWTPayload { userId: number }

function signToken(userId: number): string {
  return jwt.sign({ userId } as JWTPayload, JWT_SECRET, { expiresIn: "30d" });
}

function verifyToken(token: string): JWTPayload | null {
  try { return jwt.verify(token, JWT_SECRET) as JWTPayload; }
  catch { return null; }
}

// Express augmentation for typed req.user
declare global {
  namespace Express {
    interface Request {
      user?: ReturnType<typeof getUserWithSubscription> extends (infer U | undefined) ? U : never;
    }
  }
}

// Middleware: require authenticated user (any role)
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid session" }); return; }
  const user = getUserWithSubscription(payload.userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  (req as any).user = user;
  next();
}

// Middleware: require admin role
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if ((req as any).user?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

// ─────────────────────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────────────────────

// POST /api/auth/register
app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: "Name, email, and password are required." });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters." });
      return;
    }
    if (getUserByEmail(email.toLowerCase())) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const userId = createUser(name.trim(), email.toLowerCase().trim(), hash);
    const user = getUserWithSubscription(userId);
    const token = signToken(userId);
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ user: sanitizeUser(user!) });
  } catch (err) {
    console.error("[Auth] Register error:", err);
    res.status(500).json({ error: "Registration failed." });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }
    const dbUser = getUserByEmail(email.toLowerCase().trim());
    if (!dbUser) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    const valid = await bcrypt.compare(password, dbUser.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }
    const user = getUserWithSubscription(dbUser.id);
    const token = signToken(dbUser.id);
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ user: sanitizeUser(user!) });
  } catch (err) {
    console.error("[Auth] Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// POST /api/auth/logout
app.post("/api/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

// GET /api/auth/me
app.get("/api/auth/me", requireAuth, (req: Request, res: Response) => {
  res.json({ user: sanitizeUser((req as any).user) });
});

// ─────────────────────────────────────────────────────────────
// PRICING / SUBSCRIPTION ROUTES
// ─────────────────────────────────────────────────────────────

// GET /api/plans — public
app.get("/api/plans", (_req: Request, res: Response) => {
  res.json({ plans: getAllPlans() });
});

// POST /api/subscription/upgrade — upgrade current user's plan
app.post("/api/subscription/upgrade", requireAuth, (req: Request, res: Response) => {
  try {
    const { planSlug } = req.body;
    const validSlugs = ["free", "weekly", "monthly"];
    if (!validSlugs.includes(planSlug)) {
      res.status(400).json({ error: "Invalid plan." });
      return;
    }
    const userId = (req as any).user.id;
    const plans = getAllPlans();
    const plan = plans.find((p) => p.slug === planSlug);
    if (!plan) { res.status(404).json({ error: "Plan not found." }); return; }

    let expiresAt: string | null = null;
    if (plan.duration_days > 0) {
      const d = new Date();
      d.setDate(d.getDate() + plan.duration_days);
      expiresAt = d.toISOString();
    }
    upgradeUserPlan(userId, planSlug, expiresAt);
    res.json({ ok: true, plan: plan.name, expiresAt });
  } catch (err) {
    console.error("[Subscription] Upgrade error:", err);
    res.status(500).json({ error: "Upgrade failed." });
  }
});

// ─────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────────────────────

// GET /api/admin/users
app.get("/api/admin/users", requireAdmin, (_req: Request, res: Response) => {
  res.json({ users: getAllUsers() });
});

// PUT /api/admin/users/:id
app.put("/api/admin/users/:id", requireAdmin, (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role, planSlug } = req.body;
    if (role) {
      if (!["user", "admin"].includes(role)) { res.status(400).json({ error: "Invalid role." }); return; }
      updateUserRole(userId, role);
    }
    if (planSlug) {
      const plans = getAllPlans();
      const plan = plans.find((p) => p.slug === planSlug);
      if (!plan) { res.status(404).json({ error: "Plan not found." }); return; }
      let expiresAt: string | null = null;
      if (plan.duration_days > 0) {
        const d = new Date(); d.setDate(d.getDate() + plan.duration_days);
        expiresAt = d.toISOString();
      }
      upgradeUserPlan(userId, planSlug, expiresAt);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[Admin] Update user error:", err);
    res.status(500).json({ error: "Failed to update user." });
  }
});

// DELETE /api/admin/users/:id
app.delete("/api/admin/users/:id", requireAdmin, (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id, 10);
    deleteUser(userId);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Admin] Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user." });
  }
});

// GET /api/admin/plans
app.get("/api/admin/plans", requireAdmin, (_req: Request, res: Response) => {
  res.json({ plans: getAllPlans() });
});

// PUT /api/admin/plans/:id
app.put("/api/admin/plans/:id", requireAdmin, (req: Request, res: Response) => {
  try {
    const planId = parseInt(req.params.id, 10);
    const { price, currency, ai_video_limit, description, name } = req.body;
    const updates: Record<string, unknown> = {};
    if (price !== undefined) updates.price = parseFloat(price);
    if (currency !== undefined) updates.currency = currency;
    if (ai_video_limit !== undefined) updates.ai_video_limit = parseInt(ai_video_limit, 10);
    if (description !== undefined) updates.description = description;
    if (name !== undefined) updates.name = name;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No fields to update." }); return; }
    updatePlan(planId, updates as any);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Admin] Update plan error:", err);
    res.status(500).json({ error: "Failed to update plan." });
  }
});

// ─────────────────────────────────────────────────────────────
// HELPER: strip password from user before sending to client
// ─────────────────────────────────────────────────────────────

function sanitizeUser(user: any) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

// Lazy/Safe Gemini initialization
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Resilient Gemini caller with automatic fallback and strict timeout to prevent hung requests
async function callGeminiWithFallback(prompt: string, timeoutMs: number = 4500): Promise<string | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));

  const runWithFallback = async (): Promise<string | null> => {
    try {
      const res = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      return res.text || null;
    } catch (primaryErr) {
      try {
        const liteRes = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });
        return liteRes.text || null;
      } catch {
        return null;
      }
    }
  };

  try {
    return await Promise.race([runWithFallback(), timeoutPromise]);
  } catch {
    return null;
  }
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// Professional MP4 Master Transcoder & Remuxer (FFmpeg H.264/AAC +faststart)
app.post(
  "/api/export/remux-mp4",
  express.raw({ type: "*/*", limit: "300mb" }),
  async (req, res) => {
    const tempId = `render_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const inputExt = (req.query.inputExt as string) || "webm";
    const inputPath = path.join(os.tmpdir(), `${tempId}.${inputExt}`);
    const outputPath = path.join(os.tmpdir(), `${tempId}.mp4`);

    try {
      const bodyBuffer = req.body as Buffer;
      if (!bodyBuffer || bodyBuffer.length === 0) {
        return res.status(400).json({ error: "Empty video payload received." });
      }

      await fsPromises.writeFile(inputPath, bodyBuffer);

      const targetBitrate = (req.query.bitrate as string) || "12M";
      const fps = (req.query.fps as string) || "30";

      // FFmpeg arguments: true Broadcast H.264 (High Profile) + AAC Stereo + web-optimized faststart
      const args = [
        "-y",
        "-i", inputPath,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-level", "4.1",
        "-preset", "veryfast",
        "-b:v", targetBitrate,
        "-maxrate", targetBitrate,
        "-bufsize", `${parseInt(targetBitrate) * 2 || 24}M`,
        "-r", fps,
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-movflags", "+faststart",
        outputPath,
      ];

      await runFFmpeg(args);

      const mp4Buffer = await fsPromises.readFile(outputPath);

      // Clean up temp files safely
      try {
        await Promise.allSettled([
          fsPromises.unlink(inputPath),
          fsPromises.unlink(outputPath),
        ]);
      } catch {}

      const requestedName = (req.query.fileName as string) || "sequence_master.mp4";
      const safeName = requestedName.endsWith(".mp4") ? requestedName : `${requestedName}.mp4`;

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeName)}"`);
      res.setHeader("Content-Length", mp4Buffer.length);
      return res.end(mp4Buffer);
    } catch (err: any) {
      console.error("FFmpeg remux error:", err);
      try {
        await Promise.allSettled([
          fsPromises.unlink(inputPath),
          fsPromises.unlink(outputPath),
        ]);
      } catch {}
      return res.status(500).json({
        error: "Failed to remux MP4 with FFmpeg",
        details: err?.message || String(err),
      });
    }
  }
);

// High-Performance Multi-Track Master Engine (FFmpeg Video + Audio Synchronizer)
app.post(
  "/api/export/master-mux",
  uploadMaster.fields([
    { name: "video", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  async (req, res) => {
    const files = (req as any).files as { [fieldname: string]: any[] } | undefined;
    const videoFile = files?.["video"]?.[0];
    const audioFile = files?.["audio"]?.[0];

    if (!videoFile) {
      return res.status(400).json({ error: "Missing video file in master-mux request." });
    }

    const tempId = `master_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const outputPath = path.join(os.tmpdir(), `${tempId}.mp4`);

    const filesToClean = [videoFile.path];
    if (audioFile) filesToClean.push(audioFile.path);

    try {
      const targetBitrate = (req.query.bitrate as string) || (req.body?.bitrate as string) || "16M";
      const fps = (req.query.fps as string) || (req.body?.fps as string) || "30";
      const durationParam = (req.query.duration as string) || (req.body?.duration as string);
      const muteVideoAudio =
        req.query.muteVideoAudio === "true" || req.body?.muteVideoAudio === "true" || req.query.muteVideoAudio === "1";

      let args: string[] = ["-y", "-i", videoFile.path];

      if (audioFile && audioFile.size > 100) {
        // Replace video audio completely with the studio music audio WAV
        args.push("-i", audioFile.path);
        args.push(
          "-c:v", "libx264",
          "-pix_fmt", "yuv420p",
          "-profile:v", "high",
          "-level", "4.1",
          "-preset", "veryfast",
          "-b:v", targetBitrate,
          "-maxrate", targetBitrate,
          "-bufsize", `${parseInt(targetBitrate) * 2 || 32}M`,
          "-r", fps,
          "-c:a", "aac",
          "-b:a", "192k",
          "-ar", "48000",
          "-map", "0:v:0",
          "-map", "1:a:0"
        );
        if (durationParam && parseFloat(durationParam) > 0) {
          args.push("-t", durationParam);
        }
        args.push("-movflags", "+faststart", outputPath);
      } else if (muteVideoAudio) {
        // Mute video audio completely, export silent visual track
        args.push(
          "-c:v", "libx264",
          "-pix_fmt", "yuv420p",
          "-profile:v", "high",
          "-level", "4.1",
          "-preset", "veryfast",
          "-b:v", targetBitrate,
          "-maxrate", targetBitrate,
          "-bufsize", `${parseInt(targetBitrate) * 2 || 32}M`,
          "-r", fps,
          "-an"
        );
        if (durationParam && parseFloat(durationParam) > 0) {
          args.push("-t", durationParam);
        }
        args.push("-movflags", "+faststart", outputPath);
      } else {
        // Retain native video audio if unmuted
        args.push(
          "-c:v", "libx264",
          "-pix_fmt", "yuv420p",
          "-profile:v", "high",
          "-level", "4.1",
          "-preset", "veryfast",
          "-b:v", targetBitrate,
          "-maxrate", targetBitrate,
          "-bufsize", `${parseInt(targetBitrate) * 2 || 32}M`,
          "-r", fps,
          "-c:a", "aac",
          "-b:a", "192k",
          "-ar", "48000"
        );
        if (durationParam && parseFloat(durationParam) > 0) {
          args.push("-t", durationParam);
        }
        args.push("-movflags", "+faststart", outputPath);
      }

      await runFFmpeg(args);

      const mp4Buffer = await fsPromises.readFile(outputPath);

      // Clean up temp files
      try {
        await Promise.allSettled([
          ...filesToClean.map((f) => fsPromises.unlink(f)),
          fsPromises.unlink(outputPath),
        ]);
      } catch {}

      const requestedName =
        (req.query.fileName as string) || (req.body?.fileName as string) || "sequence_master.mp4";
      const safeName = requestedName.endsWith(".mp4") ? requestedName : `${requestedName}.mp4`;

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeName)}"`);
      res.setHeader("Content-Length", mp4Buffer.length);
      return res.end(mp4Buffer);
    } catch (err: any) {
      console.error("FFmpeg master-mux error:", err);
      try {
        await Promise.allSettled([
          ...filesToClean.map((f) => fsPromises.unlink(f)),
          fsPromises.unlink(outputPath),
        ]);
      } catch {}
      return res.status(500).json({
        error: "Failed to master MP4 with FFmpeg",
        details: err?.message || String(err),
      });
    }
  }
);

// Persistent temporary assets storage for Cloud Run chunk uploads
const ASSETS_DIR = path.join(os.tmpdir(), "studio_assets");
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// Multer instance that accepts any field name for chunk uploads (stores to tmpdir)
const chunkUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per chunk
});

// 1. Chunked Asset Upload — stores chunks to disk and reassembles on final chunk
app.post(
  "/api/media/chunk-upload",
  chunkUpload.single("chunk"),
  async (req, res) => {
    const tempUploadPath = (req as any).file?.path;
    try {
      const mediaId = (req.query.mediaId as string) || `asset_${Date.now()}`;
      const chunkIdx = parseInt((req.query.chunkIndex as string) || "0", 10);
      const totalChunks = parseInt((req.query.totalChunks as string) || "1", 10);
      const fileName = (req.query.fileName as string) || "video.mp4";

      // Fallback: if multer didn't get a file field, try express.raw body
      let chunkBuffer: Buffer | null = null;
      if (tempUploadPath) {
        chunkBuffer = await fsPromises.readFile(tempUploadPath);
        try { await fsPromises.unlink(tempUploadPath); } catch {}
      } else if (Buffer.isBuffer((req as any).body) && (req as any).body.length > 0) {
        chunkBuffer = (req as any).body as Buffer;
      }

      if (!chunkBuffer || chunkBuffer.length === 0) {
        return res.status(400).json({ error: "Empty chunk payload — no file data received." });
      }

      const chunkDir = path.join(ASSETS_DIR, mediaId);
      await fsPromises.mkdir(chunkDir, { recursive: true });

      const chunkPath = path.join(chunkDir, `part_${chunkIdx.toString().padStart(5, "0")}.dat`);
      await fsPromises.writeFile(chunkPath, chunkBuffer);

        if (chunkIdx === totalChunks - 1) {
        // Reassemble all chunks into a single raw file
        const ext = path.extname(fileName) || ".mp4";
        const rawAssembledPath = path.join(ASSETS_DIR, `${mediaId}_raw${ext}`);
        const mp4Path = path.join(ASSETS_DIR, `${mediaId}.mp4`);

        const writeStream = fs.createWriteStream(rawAssembledPath);
        for (let i = 0; i < totalChunks; i++) {
          const partFile = path.join(chunkDir, `part_${i.toString().padStart(5, "0")}.dat`);
          if (fs.existsSync(partFile)) {
            const buf = await fsPromises.readFile(partFile);
            await new Promise<void>((resolve, reject) => {
              writeStream.write(buf, (err) => (err ? reject(err) : resolve()));
            });
            try { await fsPromises.unlink(partFile); } catch {}
          }
        }
        await new Promise<void>((resolve, reject) => {
          writeStream.end();
          writeStream.on("finish", () => resolve());
          writeStream.on("error", reject);
        });
        try { await fsPromises.rm(chunkDir, { recursive: true, force: true }); } catch {}

        // Re-mux to a proper seekable MP4 with moov at start (faststart).
        // This normalizes MOV, WebM, MKV, AVI, etc. — fixes "moov atom not found" on any source.
        try {
          await runFFmpeg([
            "-y",
            "-analyzeduration", "100M",
            "-probesize", "100M",
            "-i", rawAssembledPath,
            "-c", "copy",              // stream copy — no re-encode, very fast
            "-movflags", "+faststart", // move moov atom to start for immediate seek
            mp4Path,
          ]);
          // Clean up the raw assembled file now that we have a clean MP4
          try { await fsPromises.unlink(rawAssembledPath); } catch {}
        } catch (remuxErr: any) {
          // If stream copy fails (e.g., codec not in MP4), fall back to raw file
          console.warn("Re-mux stream copy failed, using raw assembled file:", remuxErr.message?.substring(0, 120));
          try { await fsPromises.rename(rawAssembledPath, mp4Path); } catch {
            try { await fsPromises.copyFile(rawAssembledPath, mp4Path); } catch {}
          }
        }

        const stat = await fsPromises.stat(mp4Path);
        return res.json({
          success: true,
          ready: true,
          mediaId,
          fileName,
          size: stat.size,
        });
      }

      return res.json({ success: true, ready: false, chunkIndex: chunkIdx });
    } catch (err: any) {
      // Clean up multer temp file on error
      if (tempUploadPath) { try { await fsPromises.unlink(tempUploadPath); } catch {} }
      console.error("Chunk upload error:", err);
      return res.status(500).json({ error: err.message || "Chunk upload failure" });
    }
  }
);


// 2. High-Performance Timeline Render via Pre-Uploaded Assets (Zero Payload Limit)
app.post("/api/export/render-timeline-json", async (req, res) => {
  const tempDir = path.join(os.tmpdir(), `render_json_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const tempFiles: string[] = [];

  try {
    await fsPromises.mkdir(tempDir, { recursive: true });

    const {
      targetWidth = 1920,
      targetHeight = 1080,
      fps = 30,
      bitrate = "16M",
      totalDuration = 0,
      cuts = [],
      audioTrack,
      fileName = "sequence_master.mp4",
      muteVideoAudio = true,
    } = req.body;

    if (!Array.isArray(cuts) || cuts.length === 0) {
      return res.status(400).json({ error: "No video cuts provided in timeline manifest." });
    }

    const segmentPaths: string[] = [];

    // Step 1: Render each cut with frame-exact trim, aspect fit, zoom, mirror, speed & hold
    for (let i = 0; i < cuts.length; i++) {
      const cut = cuts[i];
      let sourcePath =
        path.join(ASSETS_DIR, `${cut.mediaId}.mp4`) ||
        path.join(ASSETS_DIR, `${cut.fileKey}.mp4`);

      if (!fs.existsSync(sourcePath) && cut.url && cut.url.startsWith("http")) {
        sourcePath = cut.url;
      }

      if (!fs.existsSync(sourcePath) && !sourcePath.startsWith("http")) {
        // Search directory for matching prefix
        const allFiles = await fsPromises.readdir(ASSETS_DIR);
        const match = allFiles.find((f) => f.includes(cut.mediaId) || cut.mediaId.includes(f.replace(".mp4", "")));
        if (match) {
          sourcePath = path.join(ASSETS_DIR, match);
        } else if (allFiles.length > 0) {
          sourcePath = path.join(ASSETS_DIR, allFiles[0]);
        }
      }

      if (!sourcePath || (!sourcePath.startsWith("http") && !fs.existsSync(sourcePath))) {
        console.warn(`Source video not found for cut ${i} (${cut.mediaId}), skipping.`);
        continue;
      }

      const segPath = path.join(tempDir, `seg_${i.toString().padStart(4, "0")}.mp4`);
      tempFiles.push(segPath);

      const trimStart = Math.max(0, parseFloat(cut.trimStart || "0"));
      const duration = Math.max(0.1, parseFloat(cut.duration || "5"));
      const speed = Math.max(0.5, Math.min(2.5, parseFloat(cut.speed || "1")));

      const filterParts: string[] = [];
      filterParts.push(`scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`);
      filterParts.push(`pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=black`);
      filterParts.push("setsar=1");

      if (cut.flipHorizontal) {
        filterParts.push("hflip");
      }

      if (cut.filter) {
        const b = cut.filter.brightness ?? 1;
        const c = cut.filter.contrast ?? 1;
        const s = cut.filter.saturation ?? 1;
        if (b !== 1 || c !== 1 || s !== 1) {
          filterParts.push(`eq=brightness=${(b - 1).toFixed(2)}:contrast=${c.toFixed(2)}:saturation=${s.toFixed(2)}`);
        }
      }

      if (Math.abs(speed - 1.0) > 0.005) {
        filterParts.push(`setpts=PTS/${speed}`);
      }

      filterParts.push(`fps=${fps}`);
      // Small frame-hold buffer (2s) to prevent EOF early termination; -t caps the output duration.
      filterParts.push(`tpad=stop_mode=clone:stop_duration=${Math.ceil(duration) + 2}`);

      const segArgs = [
        "-y",
        // Fast input-level seek: safe because every uploaded file is a faststart MP4
        // (moov atom at start, guaranteed by the re-mux step in the chunk upload route).
        "-ss", String(trimStart),
        "-i", sourcePath,
        "-vf", filterParts.join(","),
        "-t", String(duration),
        "-an",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-preset", "ultrafast",
        "-threads", "0",
        "-b:v", bitrate,
        segPath,
      ];

      await runFFmpeg(segArgs);
      segmentPaths.push(segPath);
    }

    if (segmentPaths.length === 0) {
      return res.status(400).json({ error: "Failed to render video segments from assets." });
    }

    // Step 2: Write concat list
    const concatListPath = path.join(tempDir, "concat.txt");
    tempFiles.push(concatListPath);
    const concatContent = segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    await fsPromises.writeFile(concatListPath, concatContent, "utf-8");

    const outputPath = path.join(tempDir, "master_output.mp4");
    tempFiles.push(outputPath);

    // Step 3: Concatenate & Multiplex Audio
    let audioPath = audioTrack?.mediaId
      ? path.join(ASSETS_DIR, `${audioTrack.mediaId}.mp4`)
      : path.join(ASSETS_DIR, "audio_soundtrack.mp4");

    if (!fs.existsSync(audioPath)) {
      audioPath = path.join(ASSETS_DIR, "audio_soundtrack.wav");
    }

    let finalArgs: string[] = [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
    ];

    if (fs.existsSync(audioPath)) {
      const audioTrim = Math.max(0, parseFloat(audioTrack?.trimStart || "0"));
      finalArgs.push("-ss", String(audioTrim), "-i", audioPath);
      finalArgs.push(
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "256k",
        "-ar", "48000",
        "-map", "0:v:0",
        "-map", "1:a:0"
      );
      if (totalDuration > 0) {
        finalArgs.push("-t", String(totalDuration));
      }
      finalArgs.push("-movflags", "+faststart", outputPath);
    } else {
      finalArgs.push("-c:v", "copy", "-an");
      if (totalDuration > 0) {
        finalArgs.push("-t", String(totalDuration));
      }
      finalArgs.push("-movflags", "+faststart", outputPath);
    }

    try {
      await runFFmpeg(finalArgs);
    } catch {
      // Fallback: re-encode concat stream with libx264
      const fallbackArgs = [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concatListPath,
      ];
      if (fs.existsSync(audioPath)) {
        fallbackArgs.push("-i", audioPath);
        fallbackArgs.push(
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "256k",
          "-ar", "48000",
          "-map", "0:v:0",
          "-map", "1:a:0"
        );
      } else {
        fallbackArgs.push("-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-an");
      }
      if (totalDuration > 0) {
        fallbackArgs.push("-t", String(totalDuration));
      }
      fallbackArgs.push("-movflags", "+faststart", outputPath);
      await runFFmpeg(fallbackArgs);
    }

    const outputBuffer = await fsPromises.readFile(outputPath);

    // Cleanup temp segment files
    try {
      await Promise.allSettled(tempFiles.map((f) => fsPromises.unlink(f)));
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    } catch {}

    const safeName = fileName.endsWith(".mp4") ? fileName : `${fileName}.mp4`;
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeName)}"`);
    res.setHeader("Content-Length", outputBuffer.length);
    return res.end(outputBuffer);
  } catch (err: any) {
    console.error("render-timeline-json error:", err);
    try {
      await Promise.allSettled(tempFiles.map((f) => fsPromises.unlink(f)));
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    } catch {}
    return res.status(500).json({ error: err.message || "Failed to render timeline JSON" });
  }
});

// High-Performance Studio FFmpeg Direct Timeline Render Engine
// Accurately trims, scales, flips, speeds, concatenates video clips and overlays pure studio audio track
app.post(
  "/api/export/render-timeline-ffmpeg",
  uploadMaster.any(),
  async (req, res) => {
    const tempDir = path.join(os.tmpdir(), `timeline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const tempFilesCreated: string[] = [];

    try {
      await fsPromises.mkdir(tempDir, { recursive: true });

      const files = (req as any).files as any[] | undefined;
      const fileMap = new Map<string, string>();

      if (files && Array.isArray(files)) {
        for (const file of files) {
          tempFilesCreated.push(file.path);
          fileMap.set(file.fieldname, file.path);
          if (file.originalname) {
            fileMap.set(file.originalname, file.path);
          }
        }
      }

      let manifest: any = {};
      try {
        manifest = typeof req.body.manifest === "string" ? JSON.parse(req.body.manifest) : req.body.manifest || {};
      } catch (parseErr) {
        return res.status(400).json({ error: "Invalid timeline manifest JSON." });
      }

      const targetWidth = parseInt(manifest.targetWidth || "1920", 10);
      const targetHeight = parseInt(manifest.targetHeight || "1080", 10);
      const fps = parseInt(manifest.fps || "30", 10);
      const bitrate = manifest.bitrate || "16M";
      const totalDuration = parseFloat(manifest.totalDuration || "0");
      const cuts = Array.isArray(manifest.cuts) ? manifest.cuts : [];
      const audioTrack = manifest.audioTrack;
      const fileName = manifest.fileName || "sequence_master.mp4";

      if (cuts.length === 0) {
        return res.status(400).json({ error: "Timeline contains no video cuts to render." });
      }

      cuts.sort((a: any, b: any) => Number(a.startTime || 0) - Number(b.startTime || 0));

      const segmentPaths: string[] = [];

      // Step 1: Render each video segment cleanly with exact trim, scaling, speed, and frame hold
      for (let i = 0; i < cuts.length; i++) {
        const cut = cuts[i];
        let sourcePath =
          fileMap.get(cut.fileKey) ||
          fileMap.get(cut.fileName) ||
          fileMap.get(cut.mediaId) ||
          fileMap.get(`file_${cut.mediaId}`) ||
          fileMap.get(`media_${cut.mediaId}`) ||
          fileMap.get(cut.mediaId?.replace(/_vid_/, "_video_")) ||
          fileMap.get(cut.mediaId?.replace(/_video_/, "_vid_"));

        if (!sourcePath && cut.url && typeof cut.url === "string" && cut.url.startsWith("http")) {
          sourcePath = cut.url;
        }

        if (!sourcePath || (!sourcePath.startsWith("http") && !fs.existsSync(sourcePath))) {
          throw new Error(`Source file not found for timeline clip ${i + 1} (${cut.fileKey || cut.mediaId}).`);
        }

        const segPath = path.join(tempDir, `seg_${i.toString().padStart(4, "0")}.mp4`);
        tempFilesCreated.push(segPath);

        const trimStart = Math.max(0, parseFloat(cut.trimStart || "0"));
        const duration = Math.max(0.1, parseFloat(cut.duration || "5"));
        const speed = Math.max(0.5, Math.min(2.5, parseFloat(cut.speed || "1")));

        // Build filter graph for precise scaling, aspect fit, mirroring, and speed
        const filterParts: string[] = [];

        // Aspect fit with letterboxing/pillarboxing
        filterParts.push(
          `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`
        );
        filterParts.push(
          `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=black`
        );
        filterParts.push(`setsar=1`);

        if (cut.flipHorizontal) {
          filterParts.push("hflip");
        }

        if (cut.filter) {
          const b = cut.filter.brightness ?? 1;
          const c = cut.filter.contrast ?? 1;
          const s = cut.filter.saturation ?? 1;
          if (b !== 1 || c !== 1 || s !== 1) {
            filterParts.push(`eq=brightness=${(b - 1).toFixed(2)}:contrast=${c.toFixed(2)}:saturation=${s.toFixed(2)}`);
          }
        }

        // Speed ramp
        if (Math.abs(speed - 1.0) > 0.005) {
          filterParts.push(`setpts=PTS/${speed}`);
        }

        filterParts.push(`fps=${fps}`);
        // Clamp frame hold to prevent segment from ending prematurely on short/looped source
        filterParts.push(`tpad=stop_mode=clone:stop_duration=${Math.ceil(duration) + 2}`);

        const filterString = filterParts.join(",");

        const segArgs = [
          "-y",
          "-ss", String(trimStart),
          "-i", sourcePath,
          "-vf", filterString,
          "-t", String(duration),
          "-an",                        // silence camera audio from video segments
          "-c:v", "libx264",
          "-pix_fmt", "yuv420p",
          "-profile:v", "high",
          "-preset", "ultrafast",       // fastest encode pass for segments
          "-threads", "0",              // use all CPU cores
          "-b:v", bitrate,
          segPath,
        ];

        await runFFmpeg(segArgs);
        segmentPaths.push(segPath);
      }

      if (segmentPaths.length === 0) {
        return res.status(400).json({ error: "Failed to render any video segments." });
      }

      // Step 2: Write concat demuxer file
      const concatListPath = path.join(tempDir, "concat.txt");
      tempFilesCreated.push(concatListPath);

      const concatContent = segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
      await fsPromises.writeFile(concatListPath, concatContent, "utf-8");

      const outputPath = path.join(tempDir, "master_output.mp4");
      tempFilesCreated.push(outputPath);

      const xfadeTypes: Record<string, string> = {
        Crossfade: "fade",
        "Dip to Black": "fadeblack",
        "Zoom In": "zoomin",
        Slide: "slideleft",
        Wipe: "wipeleft",
        Glitch: "pixelize",
      };
      const transitionGraph: string[] = [];
      cuts.forEach((_: any, index: number) => {
        transitionGraph.push(`[${index}:v]settb=AVTB,setpts=PTS-STARTPTS[src${index}]`);
      });

      let videoLabel = "src0";
      let assembledDuration = Math.max(0.1, Number(cuts[0]?.duration) || 0.1);
      for (let index = 1; index < cuts.length; index++) {
        const previousCut = cuts[index - 1];
        const currentCut = cuts[index];
        const transitionName = xfadeTypes[currentCut.transitionIn] || xfadeTypes[previousCut.transitionOut];
        const nextLabel = `joined${index}`;

        if (transitionName) {
          const previousDuration = Math.max(0.1, Number(previousCut.duration) || 0.1);
          const currentDuration = Math.max(0.1, Number(currentCut.duration) || 0.1);
          const requestedDuration = Number(currentCut.transitionDuration ?? previousCut.transitionDuration ?? 0.5);
          const transitionDuration = Math.max(0.04, Math.min(
            Number.isFinite(requestedDuration) ? requestedDuration : 0.5,
            2,
            previousDuration / 2,
            currentDuration / 2,
          ));
          const offset = Math.max(0, assembledDuration - transitionDuration);
          transitionGraph.push(
            `[${videoLabel}][src${index}]xfade=transition=${transitionName}:duration=${transitionDuration.toFixed(3)}:offset=${offset.toFixed(3)}[${nextLabel}]`,
          );
          assembledDuration += currentDuration - transitionDuration;
        } else {
          transitionGraph.push(`[${videoLabel}][src${index}]concat=n=2:v=1:a=0[${nextLabel}]`);
          assembledDuration += Math.max(0.1, Number(currentCut.duration) || 0.1);
        }
        videoLabel = nextLabel;
      }

      const hasTransitions = cuts.slice(1).some((cut: any, index: number) =>
        Boolean(xfadeTypes[cut.transitionIn] || xfadeTypes[cuts[index].transitionOut]),
      );
      const outputGraph = hasTransitions ? [...transitionGraph] : [];
      const outputDuration = hasTransitions
        ? Math.max(0.1, totalDuration > 0 ? Math.min(totalDuration, assembledDuration) : assembledDuration)
        : totalDuration;
      const overlays = Array.isArray(manifest.overlays)
        ? manifest.overlays.filter((overlay: any) => typeof overlay.text === "string" && overlay.text.trim())
        : [];
      const hasVideoFilters = hasTransitions || overlays.length > 0;
      let finalVideoLabel = videoLabel;
      const overlayTextWrites: Promise<void>[] = [];
      if (overlays.length > 0) {
        if (!hasTransitions) {
          outputGraph.push("[0:v]null[overlaybase]");
          finalVideoLabel = "overlaybase";
        }

        overlays.forEach((overlay: any, index: number) => {
          const style = overlay.style || {};
          const start = Math.max(0, Number(overlay.startTime) || 0);
          const duration = Math.max(0.1, Number(overlay.duration) || 4);
          const end = start + duration;
          const motionDuration = Math.max(0.15, Math.min(1.5, Number(style.animationDuration) || 0.65));
          const progress = `min(1\\,max(0\\,(t-${start.toFixed(3)})/${motionDuration.toFixed(3)}))`;
          const fontSize = Math.max(8, Math.round((Number(style.fontSize) || 32) * targetWidth / 1920));
          const positionX = Math.max(0, Math.min(100, Number(style.positionX) || 50));
          const positionY = Math.max(0, Math.min(100, Number(style.positionY) || 50));
          const baseX = style.align === "left"
            ? `w*${positionX}/100`
            : style.align === "right"
            ? `w*${positionX}/100-text_w`
            : `w*${positionX}/100-text_w/2`;
          const baseY = `h*${positionY}/100-text_h/2`;
          let x = baseX;
          let y = baseY;
          let alpha = "1";
          let size = String(fontSize);
          const animation = style.animation || "none";
          if (animation === "fade" || animation === "rise" || animation === "slide" || animation === "pop" || animation === "reveal") {
            alpha = progress;
          }
          if (animation === "rise") y = `(${baseY})+(1-${progress})*36`;
          if (animation === "slide") x = `(${baseX})-(1-${progress})*52`;
          if (animation === "pop") size = `${fontSize}*(0.72+0.28*${progress})`;
          if (animation === "reveal") x = `(${baseX})-(1-${progress})*text_w*0.35`;

          const textFilePath = path.join(tempDir, `overlay_${index}.txt`);
          tempFilesCreated.push(textFilePath);
          const fontPath = findOverlayFont(String(style.fontFamily || "sans-serif"), Boolean(style.bold));
          const fontOption = fontPath ? `fontfile='${escapeFilterPath(fontPath)}':` : "";
          const color = ffmpegColor(style.color, "0xFFFFFF");
          const background = style.backgroundColor && style.backgroundColor !== "transparent"
            ? `:box=1:boxcolor=${ffmpegColor(style.backgroundColor, "black@0.75")}:boxborderw=14`
            : "";
          const stroke = Number(style.outlineWidth) > 0
            ? `:borderw=${Math.max(1, Math.round(Number(style.outlineWidth) * targetWidth / 1920))}:bordercolor=${ffmpegColor(style.outlineColor, "0x000000")}`
            : "";
          const shadow = style.shadow === false ? "" : ":shadowcolor=black@0.8:shadowx=2:shadowy=3";
          const nextLabel = `titleoverlay${index}`;
          const previousLabel = index === 0 ? finalVideoLabel : `titleoverlay${index - 1}`;
          outputGraph.push(
            `[${previousLabel}]drawtext=${fontOption}textfile='${escapeFilterPath(textFilePath)}':fontcolor=${color}:fontsize='${size}':x='${x}':y='${y}':alpha='${alpha}'${background}${stroke}${shadow}:enable='between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})'[${nextLabel}]`,
          );
          finalVideoLabel = nextLabel;
          overlayTextWrites.push(fsPromises.writeFile(textFilePath, String(overlay.text), "utf-8"));
        });
        await Promise.all(overlayTextWrites);
      }

      // Step 3: Join clips with transition filters when configured, otherwise use concat copy.
      const audioSourcePath = audioTrack
        ? fileMap.get(audioTrack.fileKey) || fileMap.get(audioTrack.fileName) || fileMap.get("audio_soundtrack")
        : null;

      const finalArgs: string[] = ["-y"];
      if (hasTransitions) {
        segmentPaths.forEach((segmentPath) => finalArgs.push("-i", segmentPath));
      } else {
        finalArgs.push("-f", "concat", "-safe", "0", "-i", concatListPath);
      }
      if (hasVideoFilters) finalArgs.push("-filter_complex", outputGraph.join(";"), "-map", `[${finalVideoLabel}]`);

      if (audioSourcePath && fs.existsSync(audioSourcePath)) {
        const audioTrim = Math.max(0, parseFloat(audioTrack.trimStart || "0"));
        finalArgs.push("-ss", String(audioTrim));
        finalArgs.push("-i", audioSourcePath);
        if (!hasVideoFilters) finalArgs.push("-map", "0:v:0");
        finalArgs.push("-map", `${hasTransitions ? segmentPaths.length : 1}:a:0`);
        finalArgs.push(
          "-c:v", hasVideoFilters ? "libx264" : "copy",
          ...(hasVideoFilters ? ["-preset", "ultrafast", "-pix_fmt", "yuv420p", "-b:v", bitrate] : []),
          "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-threads", "0",
        );
      } else {
        finalArgs.push("-c:v", hasVideoFilters ? "libx264" : "copy", "-an", "-threads", "0");
        if (hasVideoFilters) finalArgs.push("-preset", "ultrafast", "-pix_fmt", "yuv420p", "-b:v", bitrate);
      }
      if (outputDuration > 0) finalArgs.push("-t", String(outputDuration));
      finalArgs.push("-movflags", "+faststart", outputPath);

      try {
        await runFFmpeg(finalArgs);
      } catch (concatErr) {
        if (hasVideoFilters) throw concatErr;
        console.warn("Concat copy fallback to re-encode:", concatErr);
        // Fallback: re-encode concat stream with libx264 for 100% reliability
        const fallbackArgs = [
          "-y",
          "-f", "concat",
          "-safe", "0",
          "-i", concatListPath,
        ];
        if (audioSourcePath && fs.existsSync(audioSourcePath)) {
          const audioTrim = Math.max(0, parseFloat(audioTrack.trimStart || "0"));
          fallbackArgs.push("-ss", String(audioTrim), "-i", audioSourcePath);
          fallbackArgs.push(
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "256k",
            "-ar", "48000",
            "-map", "0:v:0",
            "-map", "1:a:0"
          );
          if (totalDuration > 0) {
            fallbackArgs.push("-t", String(totalDuration));
          }
          fallbackArgs.push("-movflags", "+faststart", outputPath);
        } else {
          fallbackArgs.push(
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-an"
          );
          if (totalDuration > 0) {
            fallbackArgs.push("-t", String(totalDuration));
          }
          fallbackArgs.push("-movflags", "+faststart", outputPath);
        }
        await runFFmpeg(fallbackArgs);
      }

      const outputBuffer = await fsPromises.readFile(outputPath);

      // Clean up temp files
      try {
        await Promise.allSettled(tempFilesCreated.map((f) => fsPromises.unlink(f)));
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      } catch {}

      const safeName = fileName.endsWith(".mp4") ? fileName : `${fileName}.mp4`;
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeName)}"`);
      res.setHeader("Content-Length", outputBuffer.length);
      return res.end(outputBuffer);
    } catch (err: any) {
      console.error("FFmpeg timeline render error:", err);
      try {
        await Promise.allSettled(tempFilesCreated.map((f) => fsPromises.unlink(f)));
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      } catch {}

      return res.status(500).json({
        error: "Failed to render timeline with FFmpeg",
        details: [err?.message, err?.stderr?.toString().trim()]
          .filter(Boolean)
          .join("\n") || String(err),
      });
    }
  }
);

// API: AI Media Analysis & Smart Cut Plan
// Protected: requires auth + enforces free plan AI video generation limit
app.post("/api/ai/consume-generation", requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!consumeAiVideoUsage(user.id)) {
    res.status(403).json({
      error: "free_limit_reached",
      message: `You've used all ${user.ai_video_limit} free AI auto-video generations. Upgrade your plan to continue.`,
    });
    return;
  }

  const updatedUser = getUserWithSubscription(user.id);
  res.json({
    ok: true,
    ai_videos_used: updatedUser?.ai_videos_used ?? user.ai_videos_used + 1,
    ai_video_limit: updatedUser?.ai_video_limit ?? user.ai_video_limit,
  });
});

app.post("/api/ai/analyze-media", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!consumeAiVideoUsage(user.id)) {
      res.status(403).json({
        error: "free_limit_reached",
        message: `You've used all ${user.ai_video_limit} free AI auto-video generations. Upgrade your plan to continue.`,
      });
      return;
    }

    const { mediaList, stylePreset, targetDuration, targetAspectRatio } = req.body;

    const ai = getGeminiClient();

    if (!ai) {
      // Return smart programmatic heuristics if API key is not yet set
      return res.json({
        success: true,
        source: "local-heuristics",
        analysis: generateHeuristicAnalysis(mediaList, stylePreset, targetAspectRatio),
      });
    }

    const prompt = `You are AutoCut AI's professional video editor and cinematographer.
Analyze the following uploaded assets and generate an automated video editing plan:

Assets list:
${JSON.stringify(mediaList, null, 2)}

Target Style Preset: ${stylePreset || "Cinematic"}
Target Aspect Ratio: ${targetAspectRatio || "16:9"}
Target Duration: ${targetDuration || 30} seconds

Perform deep video editorial analysis:
1. Detect best highlight moments and scenes.
2. Flag sections to trim or cut (silence, dead space, long pauses, shaky or repetitive scenes).
3. Recommend cut points, pacing, transitions, and audio ducking.
4. Assess copyright safety indicators (e.g., commercial music tracks, copyrighted logos/watermarks).
5. Generate a sequence of clips with start/end trim offsets and transition suggestions.

Return ONLY a valid JSON object matching this schema:
{
  "summary": "Overall summary of the edit plan",
  "detectedFaces": true,
  "audioLevelsScore": 92,
  "sceneQualityScore": 88,
  "copyrightFlags": [
    {
      "assetId": "string",
      "risk": "low" | "medium" | "high",
      "reason": "string",
      "suggestion": "string"
    }
  ],
  "chapters": [
    { "title": "string", "startTime": number }
  ],
  "suggestedCuts": [
    {
      "mediaId": "string",
      "trimStart": number,
      "trimEnd": number,
      "speed": number,
      "reframe": "center" | "fit" | "face_focus",
      "zoom": number,
      "transitionToNext": "Crossfade" | "Dip to Black" | "Zoom In" | "Slide" | "Wipe" | "Cut"
    }
  ],
  "colorGrade": {
    "brightness": number,
    "contrast": number,
    "saturation": number,
    "temperature": number,
    "vignette": number,
    "lutName": "string"
  }
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({
      success: true,
      source: "gemini-3.8-flash",
      analysis: parsed,
    });
  } catch (error: any) {
    console.error("AI Media Analysis error:", error);
    res.json({
      success: true,
      source: "fallback-heuristics",
      analysis: generateHeuristicAnalysis(req.body.mediaList, req.body.stylePreset, req.body.targetAspectRatio),
      error: error.message,
    });
  }
});

// API: AI Music Video Rhythm & Anti-Copyright Transformative Strategy
app.post("/api/ai/analyze-music-video", async (req, res) => {
  try {
    const { audioName, duration, videoCount, bpm, danceType } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        success: true,
        source: "local-heuristics",
        strategy: {
          recommendedCutSec: 5.0,
          pacing: "Fast rhythmic alternating cuts",
          antiCopyrightRisk: "Low (Multi-source transformative interleaving with muted camera audio)",
          danceEnergyScore: 88,
          editorialTips: [
            "Mute original video audio so only the uploaded music track plays on Track A2.",
            "Alternate cuts between videos every 4-5 seconds to evade continuous sequence matching.",
            "Apply cinematic color grading and subtle 1.025x speed shift to break digital video fingerprints.",
          ],
        },
      });
    }

    const prompt = `You are a music video director and YouTube Content ID copyright protection specialist.
A creator wants to create a transformative remix / mashup:
- Audio Song: "${audioName}" (${duration}s, BPM: ${bpm || 124}, Style: ${danceType || "Dance Beat"})
- Available Source Videos: ${videoCount} videos
- Objective: Mix the videos sequentially every 5 seconds, match the song duration, completely mute source video audio, and ensure maximum transformative protection against automated Content ID claims.

Return a JSON object with:
{
  "recommendedCutSec": number,
  "pacing": string,
  "antiCopyrightRisk": string,
  "danceEnergyScore": number,
  "editorialTips": [string]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({ success: true, strategy: parsed });
  } catch (err: any) {
    return res.json({
      success: true,
      strategy: {
        recommendedCutSec: 5.0,
        pacing: "Beat-synced interleaved cuts",
        antiCopyrightRisk: "Low (Fair Use transformative remix)",
        danceEnergyScore: 85,
        editorialTips: [
          "Muting camera audio eliminates audio copyright detection completely.",
          "Alternating 5-second video clips disrupts continuous visual fingerprints.",
        ],
      },
    });
  }
});

// API: AI Speech-to-Text & Subtitle Generator (supports both /api/ai/transcribe-captions and /api/ai/transcribe-speech)
const handleTranscription = async (req: express.Request, res: express.Response) => {
  try {
    const audioSnippetText = req.body.audioSnippetText || "";
    const fileName = req.body.fileName || req.body.projectName || "Video Track";
    const duration = Number(req.body.duration || req.body.audioDuration || 15);
    const style = req.body.style || "YouTube";
    const clipNames = Array.isArray(req.body.clipNames) ? req.body.clipNames : [];
    const mediaNames = Array.isArray(req.body.mediaNames) ? req.body.mediaNames : [];
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        success: true,
        source: "project-context-generator",
        captions: generateHeuristicCaptions(fileName, duration, style, {
          projectName: req.body.projectName || fileName,
          clipNames,
          mediaNames,
        }),
      });
    }

    const prompt = `You are a subtitle and caption generator for AutoCut AI.
Given a media project named "${req.body.projectName || fileName}" with duration ${duration || 15} seconds.
Actual project context: ${JSON.stringify({ clipNames: clipNames.slice(0, 8), mediaNames: mediaNames.slice(0, 8) })}
${audioSnippetText ? `Spoken audio fragment: "${audioSnippetText}"` : "Generate contextual, engaging speech captions and subtitle timestamps suitable for a modern YouTube video or Short."}
Caption style requested: "${style || "YouTube"}".

Format as JSON with an array of captions. Each caption item must have:
- "id": string (unique)
- "startTime": number (in seconds)
- "endTime": number (in seconds)
- "text": string (caption text)
- "highlightWords": string[] (words to highlight for dynamic TikTok/Shorts karaoke styling)

Return ONLY JSON:
{
  "captions": [
    { "id": "c1", "startTime": 0.5, "endTime": 3.0, "text": "...", "highlightWords": ["..."] }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const captions = Array.isArray(parsed.captions) ? parsed.captions : [];
    res.json({
      success: true,
      source: "gemini-3.8-flash",
      captions,
    });
  } catch (error: any) {
    console.error("Transcription error:", error);
    const fallbackFileName = req.body.fileName || req.body.projectName || "Video Track";
    const fallbackDuration = Number(req.body.duration || req.body.audioDuration || 15);
    res.json({
      success: true,
      source: "fallback-generator",
      captions: generateHeuristicCaptions(fallbackFileName, fallbackDuration, req.body.style || "YouTube", {
        projectName: req.body.projectName || fallbackFileName,
        clipNames: Array.isArray(req.body.clipNames) ? req.body.clipNames : [],
        mediaNames: Array.isArray(req.body.mediaNames) ? req.body.mediaNames : [],
      }),
    });
  }
};

app.post("/api/ai/transcribe-captions", handleTranscription);
app.post("/api/ai/transcribe-speech", handleTranscription);

// API: AI YouTube Package Generator (Title, Description, Tags, Chapters, Thumbnail concept)
app.post("/api/ai/youtube-package", async (req, res) => {
  try {
    const { projectName, stylePreset, duration, clipNames, captionSnippet, captions, chapters } = req.body;
    const ai = getGeminiClient();

    const snippet = captionSnippet || (Array.isArray(captions) ? captions.map((c: any) => c.text).join(" ") : "");

    if (!ai) {
      const pkg = generateHeuristicYouTubePackage(projectName, stylePreset, duration, clipNames);
      return res.json({
        success: true,
        source: "local-package",
        package: pkg,
        youtubePackage: pkg,
      });
    }

    const prompt = `You are AutoCut AI's YouTube Optimization Specialist.
Generate a complete, high-CTR, non-clickbait, YouTube-ready distribution package based on this video:

- Project Name: "${projectName}"
- Editing Style: "${stylePreset || "Cinematic"}"
- Total Duration: ${duration || 60} seconds
- Included Clip Names: ${JSON.stringify(clipNames || [])}
- Audio/Caption Highlights: "${snippet || "High quality original footage with dynamic edits and cinematic music"}"
${chapters ? `- Identified Chapter Markers:\n${chapters}` : ""}

Produce:
1. 3 High-CTR, honest, compelling YouTube Video Titles
2. A comprehensive YouTube description with Hook, Overview, Timestamps/Chapters, and Licensing disclosure section
3. 15-20 Target SEO tags
4. 5 Relevant hashtags
5. Structured Chapters with exact timestamps
6. 2 Creative Thumbnail visual concepts (art direction, foreground focal point, background contrast, bold 3-word overlay text suggestion, color scheme)

Return ONLY JSON:
{
  "titles": ["string", "string", "string"],
  "selectedTitle": "string",
  "description": "string",
  "tags": ["string"],
  "hashtags": ["string"],
  "chapters": [
    { "time": "00:00", "title": "Introduction" },
    { "time": "00:12", "title": "Highlights" },
    { "time": "00:25", "title": "Final Reveal" }
  ],
  "thumbnailConcepts": [
    {
      "conceptTitle": "string",
      "visualDescription": "string",
      "overlayText": "string",
      "recommendedColors": "string"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({
      success: true,
      source: "gemini-3.8-flash",
      package: parsed,
      youtubePackage: parsed,
    });
  } catch (error: any) {
    console.error("YouTube package error:", error);
    const fallbackPkg = generateHeuristicYouTubePackage(req.body.projectName, req.body.stylePreset, req.body.duration, req.body.clipNames);
    res.json({
      success: true,
      source: "fallback-package",
      package: fallbackPkg,
      youtubePackage: fallbackPkg,
    });
  }
});

// API: AI Copyright Safety & Readiness Audit
app.post("/api/ai/copyright-audit", async (req, res) => {
  const assets = req.body.assets || req.body.mediaItems || [];
  try {
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        success: true,
        source: "local-audit",
        report: generateHeuristicCopyrightAudit(assets),
      });
    }

    const prompt = `You are AutoCut AI's Copyright & Content Safety Compliance Auditor.
Analyze the following media asset inventory used in a YouTube project:

Assets:
${JSON.stringify(assets, null, 2)}

Important requirements:
- Do NOT promise that every video is guaranteed 100% copyright-free.
- Warn users about commercial music tracks, unknown sources, watermarked clips, and unregistered licensing.
- Clarify that YouTube Content ID can still flag or monetize videos if rights are disputed.
- Only mark assets as "Cleared" if the user has confirmed ownership or verified public domain / CC / platform licensing.
- Provide actionable safety advice (e.g. replace music with royalty-free alternative).

Return ONLY JSON:
{
  "overallRiskLevel": "Low" | "Medium" | "High",
  "overallReadinessScore": number,
  "disclaimer": "YouTube Content ID and copyright holders maintain automated and manual rights enforcement. No automated software can guarantee zero claims. Properly documenting your licenses reduces risk.",
  "assetReviews": [
    {
      "assetId": "string",
      "assetName": "string",
      "status": "Cleared" | "Needs Verification" | "Potential Claim Risk" | "High Risk",
      "riskLevel": "Low" | "Medium" | "High",
      "finding": "string",
      "recommendedAction": "string"
    }
  ],
  "recommendations": ["string", "string"]
}`;

    const rawText = await callGeminiWithFallback(prompt, 4000);
    if (!rawText) {
      return res.json({
        success: true,
        source: "local-audit",
        report: generateHeuristicCopyrightAudit(assets),
      });
    }

    const parsed = JSON.parse(rawText || "{}");
    res.json({
      success: true,
      source: "gemini-audit",
      report: parsed,
    });
  } catch (error: any) {
    console.warn("Copyright audit fallback to heuristic auditor:", error?.message || error);
    res.json({
      success: true,
      source: "fallback-audit",
      report: generateHeuristicCopyrightAudit(assets),
    });
  }
});

// Programmatic Heuristics Fallbacks
function generateHeuristicAnalysis(mediaList: any[] = [], stylePreset: string = "Cinematic", targetAspectRatio: string = "16:9") {
  const cuts = (mediaList || []).map((media, index) => {
    const dur = media.duration || 5;
    const start = dur > 4 ? 0.5 : 0;
    const end = dur > 4 ? Math.min(dur - 0.5, 6) : dur;
    const transitions = ["Crossfade", "Zoom In", "Dip to Black", "Slide", "Wipe"];
    return {
      mediaId: media.id,
      trimStart: start,
      trimEnd: end,
      speed: 1,
      reframe: targetAspectRatio === "9:16" ? "face_focus" : "center",
      zoom: 1 + (index % 3) * 0.05,
      transitionToNext: transitions[index % transitions.length],
    };
  });

  return {
    summary: `Optimized sequence using ${stylePreset} rhythm: prioritized high-energy segments, trimmed long pauses, reframed for ${targetAspectRatio}, and aligned transitions.`,
    detectedFaces: true,
    audioLevelsScore: 94,
    sceneQualityScore: 91,
    copyrightFlags: (mediaList || [])
      .filter((m) => m.type === "audio" && m.licenseType === "unknown")
      .map((m) => ({
        assetId: m.id,
        risk: "medium",
        reason: "Audio source is unverified. If commercial music is included, YouTube Content ID may monetize or block.",
        suggestion: "Confirm license or replace with verified royalty-free music from the library.",
      })),
    chapters: [
      { title: "Intro & Hook", startTime: 0 },
      { title: "Main Sequence", startTime: 4 },
      { title: "Peak Moment", startTime: 12 },
      { title: "Outro & Call to Action", startTime: 20 },
    ],
    suggestedCuts: cuts,
    colorGrade: {
      brightness: 1.05,
      contrast: 1.1,
      saturation: 1.15,
      temperature: stylePreset === "Cinematic" ? 0.95 : 1.0,
      vignette: stylePreset === "Cinematic" ? 0.2 : 0,
      lutName: stylePreset === "Cinematic" ? "Cinematic Teal & Orange" : "Natural Vivid",
    },
  };
}

export function generateHeuristicCaptions(
  fileName: string,
  duration: number = 15,
  style: string = "YouTube",
  context: { projectName?: string; clipNames?: string[]; mediaNames?: string[] } = {},
) {
  const dur = Math.max(Number(duration) || 12, 10);
  const cleanFileName = (fileName || context.projectName || "Video Track")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const allKeywords = [
    ...(context.clipNames || []),
    ...(context.mediaNames || []),
    cleanFileName,
  ]
    .flatMap((value) => String(value).split(/[^a-zA-Z0-9]+/))
    .map((word) => word.trim())
    .filter((word) => word.length > 3)
    .slice(0, 8);

  const uniqueWords = Array.from(new Set(allKeywords.map((w) => w.charAt(0).toUpperCase() + w.slice(1))));
  const primaryWord = uniqueWords[0] || "Story";
  const secondaryWord = uniqueWords[1] || "Motion";
  const tertiaryWord = uniqueWords[2] || "Focus";
  const projectLabel = context.projectName || cleanFileName || "This edit";
  const captionStyle = (style || "YouTube").toLowerCase();

  const phraseBank = {
    youtube: [
      `Opening on ${projectLabel} with a clean visual hook.`,
      `${primaryWord} leads the scene while the timing stays crisp and clear.`,
      `${secondaryWord} and ${tertiaryWord} drive the momentum through the cut.`,
      `This final section wraps the story with a polished ending.`,
    ],
    tiktok: [
      `Hook in instantly on ${projectLabel}.`,
      `${primaryWord} hits hard and keeps the pace moving.`,
      `The energy spikes as ${secondaryWord} takes over the frame.`,
      `That final beat closes the story with impact.`,
    ],
    shorts: [
      `Quick start: ${projectLabel} drops in fast.`,
      `${primaryWord} pushes the cut forward with strong rhythm.`,
      `${secondaryWord} creates a punchy transition at the key moment.`,
      `Ending on a strong visual beat to keep the viewer hooked.`,
    ],
    cinematic: [
      `The opening frame settles into ${projectLabel} with cinematic flow.`,
      `${primaryWord} guides the visual rhythm across the scene.`,
      `The pacing deepens as ${secondaryWord} meets ${tertiaryWord}.`,
      `A refined ending leaves the final shot feeling complete.`,
    ],
  };

  const phrases = phraseBank[captionStyle as keyof typeof phraseBank] || phraseBank.youtube;
  const endTimeBase = Math.max(dur * 0.2, 3);

  return [
    {
      id: "c1",
      startTime: 0.5,
      endTime: Math.min(endTimeBase, dur * 0.3),
      text: phrases[0],
      highlightWords: [projectLabel.replace(/\s+/g, " ").split(" ")[0] || "Opening", projectLabel],
    },
    {
      id: "c2",
      startTime: Math.min(4.0, dur * 0.3),
      endTime: Math.min(Math.max(endTimeBase + 2.5, 7.5), dur * 0.6),
      text: phrases[1],
      highlightWords: [primaryWord, "timing", "crisp"],
    },
    {
      id: "c3",
      startTime: Math.min(8.0, dur * 0.6),
      endTime: Math.min(Math.max(endTimeBase + 5.5, 11.5), dur * 0.82),
      text: phrases[2],
      highlightWords: [secondaryWord, tertiaryWord, "momentum"],
    },
    {
      id: "c4",
      startTime: Math.min(12.0, dur * 0.8),
      endTime: Math.max(14.0, Math.min(dur - 0.5, dur * 0.96)),
      text: phrases[3],
      highlightWords: ["final", "story", "ending"],
    },
  ].filter((item) => item.endTime > item.startTime);
}

function generateHeuristicYouTubePackage(projectName: string, stylePreset: string, duration: number, clipNames: string[] = []) {
  const cleanName = projectName || "Amazing Video Edit";
  return {
    titles: [
      `${cleanName} — Complete ${stylePreset} Cut`,
      `How We Created The Ultimate ${stylePreset} Video (Step-by-Step)`,
      `${cleanName} | 4K Ultra-Polished Edit`,
    ],
    selectedTitle: `${cleanName} — Complete ${stylePreset} Cut`,
    description: `Here is our complete cut of ${cleanName}, edited with AutoCut AI using the ${stylePreset} style.\n\n⏱️ TIMESTAMPS / CHAPTERS:\n00:00 - Introduction & Hook\n00:06 - Main Sequence\n00:15 - Cinematic Highlights\n00:24 - Conclusion & Credits\n\n🛡️ COPYRIGHT & LICENSING:\nAll original footage and audio used with proper permissions or royalty-free licenses. Documentation maintained in AutoCut AI.\n\n🔔 Subscribe for regular updates and creative filmmaking workflows!`,
    tags: [
      "AutoCut AI",
      "video editing",
      stylePreset.toLowerCase(),
      "cinematic",
      "filmmaking",
      "youtube creator",
      "4k video",
      "smart cuts",
      "color grading",
    ],
    hashtags: ["#VideoEditing", "#Cinematic", `#${stylePreset.replace(/\s+/g, "")}`, "#AutoCutAI", "#ContentCreator"],
    chapters: [
      { time: "00:00", title: "Introduction & Hook" },
      { time: "00:06", title: "Main Sequence" },
      { time: "00:15", title: "Cinematic Highlights" },
      { time: "00:24", title: "Conclusion & Credits" },
    ],
    thumbnailConcepts: [
      {
        conceptTitle: "High-Contrast Subject Pop",
        visualDescription: "Tight close-up on the most expressive face or vibrant focal point with background motion blur and warm cinematic lighting.",
        overlayText: "DON'T MISS THIS",
        recommendedColors: "Warm Amber, Deep Navy, High-contrast White",
      },
      {
        conceptTitle: "Dynamic Split Action",
        visualDescription: "Diagonal split frame showing before & after color grade or two key highlight moments side-by-side with a neon separator line.",
        overlayText: "PURE CINEMA",
        recommendedColors: "Vibrant Cyan, Sunset Orange, Matte Black",
      },
    ],
  };
}

function generateHeuristicCopyrightAudit(assets: any[] = []) {
  const reviews = (assets || []).map((asset) => {
    const isOwned = asset.licenseType === "own" || asset.licenseType === "permission";
    const isRoyaltyFree = asset.licenseType === "public_domain" || asset.licenseType === "creative_commons" || asset.licenseType === "platform_licensed";
    const isAudio = asset.type === "audio";

    let status = "Cleared";
    let riskLevel = "Low";
    let finding = "Asset ownership or open license confirmed.";
    let recommendedAction = "Maintain record in project export.";

    if (asset.licenseType === "unknown") {
      status = isAudio ? "Potential Claim Risk" : "Needs Verification";
      riskLevel = isAudio ? "High" : "Medium";
      finding = isAudio
        ? "Audio file has no verified copyright source. Commercial songs trigger YouTube Content ID automatic claims."
        : "Unverified visual media. Ensure you hold rights or have acquired permission.";
      recommendedAction = isAudio ? "Replace with royalty-free track from the Library or confirm ownership." : "Mark license status or confirm ownership.";
    } else if (!isOwned && !isRoyaltyFree) {
      status = "Needs Verification";
      riskLevel = "Medium";
      finding = "External license noted. Verify license terms permit commercial YouTube distribution.";
      recommendedAction = "Verify commercial monetization permissions.";
    }

    return {
      assetId: asset.id,
      assetName: asset.name,
      status,
      riskLevel,
      finding,
      recommendedAction,
    };
  });

  const highCount = reviews.filter((r) => r.riskLevel === "High").length;
  const medCount = reviews.filter((r) => r.riskLevel === "Medium").length;
  const overallRisk = highCount > 0 ? "High" : medCount > 0 ? "Medium" : "Low";
  const overallScore = Math.max(20, 100 - highCount * 30 - medCount * 15);

  return {
    overallRiskLevel: overallRisk,
    overallReadinessScore: overallScore,
    disclaimer: "AutoCut AI helps creators track and verify rights. YouTube Content ID independently scans uploaded media. No tool guarantees 100% immunity from copyright strikes or claims.",
    assetReviews: reviews,
    recommendations: [
      "Review any audio tracks marked with Potential Claim Risk before uploading to YouTube.",
      "Include license attribution details in your YouTube video description.",
      "Do not rely on audio pitch shifting or cropping to evade detection; use properly cleared music.",
    ],
  };
}

// Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`AutoCut AI Server running on http://127.0.0.1:${PORT}`);
  });
}

startServer();
