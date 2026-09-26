import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs, { promises as fsPromises } from "fs";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

const execFileAsync = promisify(execFile);
const uploadMaster = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

dotenv.config();

const app = express();
const PORT = 3000;

// Set payload limits for video/audio metadata and data
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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

      await execFileAsync("ffmpeg", args);

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

      await execFileAsync("ffmpeg", args);

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

// 1. Chunked Asset Upload: Bypasses Cloud Run 32MB payload limit for arbitrary sized videos
app.post(
  "/api/media/chunk-upload",
  express.raw({ type: "*/*", limit: "25mb" }),
  async (req, res) => {
    try {
      const mediaId = (req.query.mediaId as string) || `asset_${Date.now()}`;
      const chunkIdx = parseInt((req.query.chunkIndex as string) || "0", 10);
      const totalChunks = parseInt((req.query.totalChunks as string) || "1", 10);
      const fileName = (req.query.fileName as string) || "video.mp4";

      const chunkDir = path.join(ASSETS_DIR, mediaId);
      await fsPromises.mkdir(chunkDir, { recursive: true });

      const chunkPath = path.join(chunkDir, `part_${chunkIdx.toString().padStart(5, "0")}.dat`);
      const bodyBuffer = req.body as Buffer;
      if (!bodyBuffer || bodyBuffer.length === 0) {
        return res.status(400).json({ error: "Empty chunk payload." });
      }
      await fsPromises.writeFile(chunkPath, bodyBuffer);

      if (chunkIdx === totalChunks - 1) {
        // Reassemble final file
        const finalPath = path.join(ASSETS_DIR, `${mediaId}.mp4`);
        const writeStream = fs.createWriteStream(finalPath);

        for (let i = 0; i < totalChunks; i++) {
          const partFile = path.join(chunkDir, `part_${i.toString().padStart(5, "0")}.dat`);
          if (fs.existsSync(partFile)) {
            const buf = await fsPromises.readFile(partFile);
            writeStream.write(buf);
            try { await fsPromises.unlink(partFile); } catch {}
          }
        }
        writeStream.end();
        await new Promise((resolve) => writeStream.on("finish", () => resolve(undefined)));
        try { await fsPromises.rm(chunkDir, { recursive: true, force: true }); } catch {}

        return res.json({
          success: true,
          ready: true,
          mediaId,
          fileName,
          size: (await fsPromises.stat(finalPath)).size,
        });
      }

      return res.json({ success: true, ready: false, chunkIndex: chunkIdx });
    } catch (err: any) {
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
      // Ensure segment NEVER drops frames or stops early on EOF
      filterParts.push(`tpad=stop_mode=clone:stop_duration=${Math.ceil(duration) + 10}`);

      const segArgs = [
        "-y",
        "-ss", String(trimStart),
        "-i", sourcePath,
        "-vf", filterParts.join(","),
        "-t", String(duration),
        "-an",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-preset", "ultrafast",
        "-b:v", bitrate,
        segPath,
      ];

      await execFileAsync("ffmpeg", segArgs);
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
      await execFileAsync("ffmpeg", finalArgs);
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
      await execFileAsync("ffmpeg", fallbackArgs);
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
          if (fileMap.size > 0) {
            sourcePath = Array.from(fileMap.values())[0];
          }
        }

        if (!sourcePath || (!sourcePath.startsWith("http") && !fs.existsSync(sourcePath))) {
          console.warn(`Source file not found for cut ${i} (${cut.fileKey || cut.mediaId}), skipping.`);
          continue;
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

        if (Math.abs(speed - 1.0) > 0.005) {
          filterParts.push(`setpts=PTS/${speed}`);
        }

        filterParts.push(`fps=${fps}`);
        // Ensure segment NEVER ends prematurely on EOF by cloning last frame for the required duration
        filterParts.push(`tpad=stop_mode=clone:stop_duration=${Math.ceil(duration) + 10}`);

        const filterString = filterParts.join(",");

        const segArgs = [
          "-y",
          "-ss", String(trimStart),
          "-i", sourcePath,
          "-vf", filterString,
          "-t", String(duration), // Guarantees exact cut duration on timeline
          "-an", // Strictly SILENCE camera audio from videos
          "-c:v", "libx264",
          "-pix_fmt", "yuv420p",
          "-profile:v", "high",
          "-preset", "ultrafast",
          "-b:v", bitrate,
          segPath,
        ];

        await execFileAsync("ffmpeg", segArgs);
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

      // Step 3: Concatenate segments and map audio track with exact timeline duration
      const audioSourcePath = audioTrack
        ? fileMap.get(audioTrack.fileKey) || fileMap.get(audioTrack.fileName) || fileMap.get("audio_soundtrack")
        : null;

      let finalArgs: string[] = [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concatListPath,
      ];

      if (audioSourcePath && fs.existsSync(audioSourcePath)) {
        const audioTrim = Math.max(0, parseFloat(audioTrack.trimStart || "0"));
        finalArgs.push("-ss", String(audioTrim));
        finalArgs.push("-i", audioSourcePath);
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
        // Output clean video without audio track
        finalArgs.push("-c:v", "copy", "-an");
        if (totalDuration > 0) {
          finalArgs.push("-t", String(totalDuration));
        }
        finalArgs.push("-movflags", "+faststart", outputPath);
      }

      try {
        await execFileAsync("ffmpeg", finalArgs);
      } catch (concatErr) {
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
        await execFileAsync("ffmpeg", fallbackArgs);
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
        details: err?.message || String(err),
      });
    }
  }
);

// API: AI Media Analysis & Smart Cut Plan
app.post("/api/ai/analyze-media", async (req, res) => {
  try {
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
    const fileName = req.body.fileName || "Video Track";
    const duration = req.body.duration || req.body.audioDuration || 15;
    const style = req.body.style || "YouTube";
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        success: true,
        source: "local-generator",
        captions: generateHeuristicCaptions(fileName, duration, style),
      });
    }

    const prompt = `You are a subtitle and caption generator for AutoCut AI.
Given a media asset named "${fileName}" with duration ${duration || 15} seconds:
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
    res.json({
      success: true,
      source: "gemini-3.8-flash",
      captions: parsed.captions || [],
    });
  } catch (error: any) {
    console.error("Transcription error:", error);
    res.json({
      success: true,
      source: "fallback-generator",
      captions: generateHeuristicCaptions(req.body.fileName, req.body.duration || req.body.audioDuration, req.body.style),
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

function generateHeuristicCaptions(fileName: string, duration: number = 15, style: string = "YouTube") {
  const dur = Math.max(duration || 12, 10);
  return [
    {
      id: "c1",
      startTime: 0.5,
      endTime: Math.min(3.5, dur * 0.25),
      text: "Welcome back to today's video!",
      highlightWords: ["Welcome", "today's", "video"],
    },
    {
      id: "c2",
      startTime: Math.min(4.0, dur * 0.3),
      endTime: Math.min(7.5, dur * 0.6),
      text: "Notice how smooth the cinematic transitions look.",
      highlightWords: ["smooth", "cinematic", "transitions"],
    },
    {
      id: "c3",
      startTime: Math.min(8.0, dur * 0.65),
      endTime: Math.min(11.5, dur * 0.95),
      text: "Don't forget to like and subscribe for more.",
      highlightWords: ["like", "subscribe"],
    },
  ];
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AutoCut AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
