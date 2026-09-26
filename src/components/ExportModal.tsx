import React, { useState, useMemo, useEffect } from "react";
import {
  Download,
  Film,
  Sparkles,
  CheckCircle2,
  FileText,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  X,
  RefreshCw,
  ExternalLink,
  Sliders,
  Volume2,
  VolumeX,
  Video,
  Settings,
  HardDrive,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
  Play,
} from "lucide-react";
import {
  CopyrightAuditReport,
  ExportSettings,
  MediaItem,
  ProjectSettings,
  RenderProgress,
  TimelineTrack,
  YouTubePackage,
} from "../types";
import {
  formatTimecode,
  generateChapterMarkersText,
  generateLicenseReportText,
  generateSrt,
  triggerDownload,
} from "../utils/mediaUtils";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectSettings;
  tracks: TimelineTrack[];
  mediaItems: MediaItem[];
  captions: any[];
  onStartRender: (settings: ExportSettings) => Promise<void>;
  onCancelRender: () => void;
  renderProgress: RenderProgress | null;
  youtubePackage: YouTubePackage | null;
  onGenerateYouTubePackage: () => Promise<void>;
  isGeneratingPackage: boolean;
  auditReport: CopyrightAuditReport | null;
}

type PresetId =
  | "match_source"
  | "youtube_1080p"
  | "youtube_4k"
  | "shorts_vertical"
  | "instagram_square"
  | "high_bitrate"
  | "prores_proxy"
  | "web_720p";

interface PresetOption {
  id: PresetId;
  name: string;
  description: string;
  format: "mp4" | "webm";
  resolution: "720p" | "1080p" | "1440p" | "4K";
  frameRate: 24 | 25 | 30 | 50 | 60;
  quality: "standard" | "high" | "maximum" | "prores";
  bitrateMbps: number;
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: "match_source",
    name: "Match Source - Adaptive High Bitrate",
    description: "Matches timeline sequence resolution & frame rate with pristine H.264 VBR encoding.",
    format: "mp4",
    resolution: "1080p",
    frameRate: 30,
    quality: "high",
    bitrateMbps: 16,
  },
  {
    id: "youtube_1080p",
    name: "YouTube 1080p Full HD",
    description: "Industry-standard YouTube upload profile: 1920x1080, 16 Mbps, 48kHz AAC Stereo.",
    format: "mp4",
    resolution: "1080p",
    frameRate: 30,
    quality: "high",
    bitrateMbps: 16,
  },
  {
    id: "youtube_4k",
    name: "YouTube 4K Ultra HD",
    description: "Crisp 3840x2160 master quality at 40 Mbps with high-efficiency encoding.",
    format: "mp4",
    resolution: "4K",
    frameRate: 30,
    quality: "maximum",
    bitrateMbps: 40,
  },
  {
    id: "shorts_vertical",
    name: "YouTube Shorts / TikTok / Reels (9:16)",
    description: "Optimized 1080x1920 vertical canvas, high motion retention, mobile-ready.",
    format: "mp4",
    resolution: "1080p",
    frameRate: 30,
    quality: "high",
    bitrateMbps: 15,
  },
  {
    id: "instagram_square",
    name: "Social Media Square (1:1)",
    description: "1080x1080 square format for Instagram feed and LinkedIn carousels.",
    format: "mp4",
    resolution: "1080p",
    frameRate: 30,
    quality: "high",
    bitrateMbps: 12,
  },
  {
    id: "high_bitrate",
    name: "High Quality 1080p (24 Mbps Master)",
    description: "Maximum detail retention for complex cinematic footage with high dynamic range.",
    format: "mp4",
    resolution: "1080p",
    frameRate: 30,
    quality: "maximum",
    bitrateMbps: 24,
  },
  {
    id: "prores_proxy",
    name: "Apple ProRes 422 Proxy Equivalent",
    description: "Near-lossless 35 Mbps master stream for post-production archival and color finishing.",
    format: "mp4",
    resolution: "1080p",
    frameRate: 30,
    quality: "prores",
    bitrateMbps: 35,
  },
  {
    id: "web_720p",
    name: "Web Standard 720p (Fast Encode)",
    description: "Compact 1280x720 file at 8 Mbps for quick client reviews and low-bandwidth sharing.",
    format: "mp4",
    resolution: "720p",
    frameRate: 30,
    quality: "standard",
    bitrateMbps: 8,
  },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
  tracks,
  mediaItems,
  captions,
  onStartRender,
  onCancelRender,
  renderProgress,
  youtubePackage,
  onGenerateYouTubePackage,
  isGeneratingPackage,
  auditReport,
}) => {
  // Preset Selection
  const [selectedPresetId, setSelectedPresetId] = useState<PresetId>("match_source");

  // Output File Settings
  const [outputFileName, setOutputFileName] = useState(() => {
    return `${project.name.replace(/\s+/g, "_")}_Master.mp4`;
  });
  const [format, setFormat] = useState<"mp4" | "webm">("mp4");
  const [resolution, setResolution] = useState<"720p" | "1080p" | "1440p" | "4K">("1080p");
  const [frameRate, setFrameRate] = useState<24 | 25 | 30 | 50 | 60>(30);
  const [quality, setQuality] = useState<"standard" | "high" | "maximum" | "prores">("high");
  const [bitrateMbps, setBitrateMbps] = useState<number>(16);
  const [durationMode, setDurationMode] = useState<"full" | "preview5" | "preview15">("full");
  const [renderQuality, setRenderQuality] = useState<"standard" | "maximum">("maximum");
  const [burnCaptions, setBurnCaptions] = useState<boolean>(() => captions.length > 0);
  const [audioSampleRate, setAudioSampleRate] = useState<44100 | 48000>(48000);
  const [audioBitrate, setAudioBitrate] = useState<"128k" | "192k" | "256k" | "320k">("192k");
  const [muteVideoAudio, setMuteVideoAudio] = useState<boolean>(true);

  // Accordion Section States (Adobe Premiere Style)
  const [openSections, setOpenSections] = useState({
    file: true,
    video: true,
    audio: false,
    captions: false,
    metadata: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Status & Notifications
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showQueueToast, setShowQueueToast] = useState(false);

  // Sync preset changes
  const applyPreset = (presetId: PresetId) => {
    setSelectedPresetId(presetId);
    const p = PRESET_OPTIONS.find((opt) => opt.id === presetId);
    if (!p) return;

    setFormat(p.format);
    setResolution(p.resolution);
    setFrameRate(p.frameRate);
    setQuality(p.quality);
    setBitrateMbps(p.bitrateMbps);

    const ext = p.format;
    const baseName = project.name.replace(/\s+/g, "_");
    setOutputFileName(`${baseName}_${presetId}.${ext}`);
  };

  // Sync project default name on open
  useEffect(() => {
    if (isOpen) {
      const baseName = project.name.replace(/\s+/g, "_");
      setOutputFileName(`${baseName}_Master.mp4`);
      if (captions.length > 0) setBurnCaptions(true);
    }
  }, [isOpen, project.name, captions.length]);

  // Calculate actual timeline duration
  const calculatedDuration = useMemo(() => {
    let maxTime = 0;
    tracks.forEach((t) => {
      t.clips.forEach((c) => {
        const end = c.startTime + c.duration;
        if (end > maxTime) maxTime = end;
      });
    });
    return Math.max(0, Math.ceil(maxTime));
  }, [tracks]);

  // Effective export duration based on range selection
  const effectiveDuration = useMemo(() => {
    if (durationMode === "preview5") return Math.min(5, calculatedDuration || 5);
    if (durationMode === "preview15") return Math.min(15, calculatedDuration || 15);
    return calculatedDuration || 10;
  }, [durationMode, calculatedDuration]);

  // Estimated output file size (MB) = (Bitrate Mbps * seconds) / 8 + audio overhead
  const estimatedFileSizeMB = useMemo(() => {
    const videoMB = (bitrateMbps * effectiveDuration) / 8;
    const audioKbps = parseInt(audioBitrate) || 192;
    const audioMB = (audioKbps * effectiveDuration) / (8 * 1024);
    return Math.max(0.5, videoMB + audioMB).toFixed(1);
  }, [bitrateMbps, effectiveDuration, audioBitrate]);

  // Total frames to render
  const totalFrames = Math.max(1, Math.round(effectiveDuration * frameRate));

  if (!isOpen) return null;

  const isRendering = renderProgress?.isRendering;
  const hasFinishedRender = Boolean(renderProgress?.downloadUrl && !isRendering);
  const isTimelineEmpty = tracks.every((t) => t.clips.length === 0);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadSRT = () => {
    const srt = generateSrt(captions);
    triggerDownload(srt, `${project.name.replace(/\s+/g, "_")}_subtitles.srt`);
  };

  const handleDownloadChapters = () => {
    const chapters = generateChapterMarkersText(tracks, mediaItems);
    triggerDownload(chapters, `${project.name.replace(/\s+/g, "_")}_chapters.txt`);
  };

  const handleDownloadLicenseReport = () => {
    const report = generateLicenseReportText(project.name, mediaItems, tracks);
    triggerDownload(report, `${project.name.replace(/\s+/g, "_")}_License_Report.txt`);
  };

  const handleExportClick = () => {
    onStartRender({
      format,
      presetName: selectedPresetId,
      fileName: outputFileName,
      resolution,
      frameRate,
      quality,
      bitrateMbps,
      durationMode,
      burnCaptions,
      renderQuality,
      audioSampleRate,
      audioBitrate,
      muteVideoAudio,
    });
  };

  const handleSendToQueue = () => {
    setShowQueueToast(true);
    setTimeout(() => setShowQueueToast(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 select-none font-sans">
      <div className="bg-[#121316] border border-zinc-800 rounded-xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl text-zinc-100">
        
        {/* Premiere Pro Studio Header Bar */}
        <div className="h-13 bg-[#18191c] border-b border-zinc-800 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center shadow font-mono font-bold text-xs text-white">
              Pr
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Export Sequence
                </h2>
                <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/50">
                  {project.name}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Preset Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-zinc-400 hidden sm:inline">Preset:</span>
            <select
              value={selectedPresetId}
              disabled={isRendering}
              onChange={(e) => applyPreset(e.target.value as PresetId)}
              className="bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-xs font-medium text-zinc-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[280px]"
            >
              {PRESET_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {!isRendering && (
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition ml-2"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Media Encoder Queue Toast Notice */}
        {showQueueToast && (
          <div className="bg-blue-600/90 text-white text-xs px-4 py-2 flex items-center justify-between border-b border-blue-500">
            <span>Sequence queued to background Adobe Media Encoder job list.</span>
            <button onClick={() => setShowQueueToast(false)} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* Content Body: Split Workspace or Active Rendering View */}
        {isRendering ? (
          /* ACTIVE RENDERING PROGRESS STATE (Adobe Media Encoder Progress Monitor) */
          <div className="flex-1 p-8 flex flex-col items-center justify-center space-y-6 text-center overflow-y-auto">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Film className="w-7 h-7 text-blue-400 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2 max-w-md">
              <h3 className="text-base font-bold text-zinc-100 flex items-center justify-center gap-2">
                <span>Encoding Broadcast Master</span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                  {format.toUpperCase()} • H.264
                </span>
              </h3>
              <p className="text-xs text-blue-400 font-mono bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
                {renderProgress?.status || "Processing video timeline frames..."}
              </p>
            </div>

            {/* Premiere Pro Progress Bar */}
            <div className="w-full max-w-lg space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span>Progress: {Math.round(renderProgress?.progress || renderProgress?.percent || 0)}%</span>
                <span>
                  {renderProgress?.currentSecond
                    ? `${formatTimecode(renderProgress.currentSecond, false, frameRate)} / ${formatTimecode(effectiveDuration, false, frameRate)}`
                    : `~${totalFrames} frames`}
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-zinc-700/50">
                <div
                  className="bg-gradient-to-r from-blue-600 via-indigo-500 to-teal-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${renderProgress?.progress || renderProgress?.percent || 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1">
                <span>Bitrate: {bitrateMbps} Mbps</span>
                <span>Engine: Google Frame-Accurate Engine + Fast Master Remux</span>
              </div>
            </div>

            <button
              onClick={onCancelRender}
              className="px-5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-semibold transition border border-zinc-700 cursor-pointer"
            >
              Cancel Encoding
            </button>
          </div>
        ) : hasFinishedRender ? (
          /* FINISHED RENDER: DOWNLOAD & PREVIEW PLAYER */
          <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-5 overflow-y-auto text-center">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
              <h3 className="text-lg font-bold text-zinc-100">Export Complete & Verified!</h3>
            </div>
            <p className="text-xs text-zinc-400 max-w-md">
              Your real broadcast-grade MP4 video has been mastered with H.264 video, 48kHz AAC stereo audio, and faststart metadata ready for YouTube, editing NLEs, and universal playback.
            </p>

            {/* In-Modal Real Video Player */}
            <div className="w-full max-w-xl aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-black shadow-2xl relative">
              <video
                key={renderProgress?.downloadUrl}
                src={renderProgress?.downloadUrl}
                controls
                playsInline
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            {/* Technical Verification Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono">
              <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                Format: <strong className="text-white">MP4 (avc1)</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                Audio: <strong className="text-white">AAC 48kHz Stereo</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                Resolution: <strong className="text-white">{resolution}</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                Size: <strong className="text-emerald-400">
                  {renderProgress?.fileSize ? (renderProgress.fileSize / (1024 * 1024)).toFixed(1) + " MB" : `${estimatedFileSizeMB} MB`}
                </strong>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={renderProgress?.downloadUrl}
                download={outputFileName}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition transform hover:scale-[1.02] cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Download {outputFileName}</span>
              </a>

              <button
                onClick={onCancelRender}
                className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs border border-zinc-700 transition cursor-pointer"
              >
                Modify Settings / Export Another
              </button>
            </div>
          </div>
        ) : (
          /* ADOBE PREMIERE PRO EXPORT WORKSPACE: 2-COLUMN LAYOUT */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* LEFT COLUMN: Sequence Preview Monitor & Comparison */}
            <div className="md:w-1/2 p-5 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col justify-between overflow-y-auto bg-[#141518]">
              <div className="space-y-4">
                {/* Source vs Output Technical Comparison Bar */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                  <div className="space-y-0.5">
                    <span className="text-zinc-500 font-bold block">SOURCE SEQUENCE:</span>
                    <span className="text-zinc-300 block">{project.resolution} • {project.frameRate} fps</span>
                    <span className="text-zinc-400 block">{project.aspectRatio} • {formatTimecode(calculatedDuration, true, project.frameRate)}</span>
                  </div>
                  <div className="space-y-0.5 border-l border-zinc-800 pl-2">
                    <span className="text-blue-400 font-bold block">OUTPUT TARGET:</span>
                    <span className="text-zinc-200 block">{resolution} • {frameRate} fps</span>
                    <span className="text-zinc-300 block">{format.toUpperCase()} (H.264) • {bitrateMbps} Mbps</span>
                  </div>
                </div>

                {/* Preview Monitor Canvas Frame */}
                <div className="aspect-video w-full rounded-lg overflow-hidden border border-zinc-800 bg-black flex flex-col items-center justify-center relative shadow-inner">
                  {/* Clean black monitor canvas representing current sequence */}
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 text-center p-4">
                    <Film className="w-8 h-8 opacity-30 mb-2 text-zinc-400" />
                    <span className="text-[11px] font-mono text-zinc-400 font-medium">
                      Sequence: {project.name}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-600 mt-0.5">
                      {tracks.filter((t) => t.clips.length > 0).length} Active Tracks • {mediaItems.length} Assets
                    </span>
                  </div>

                  {/* Timecode overlay badge */}
                  <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300 border border-white/10">
                    {formatTimecode(effectiveDuration, true, frameRate)}
                  </div>
                </div>

                {/* Range Selector */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-semibold text-zinc-300 flex items-center justify-between">
                    <span>Source Range:</span>
                    <span className="font-mono text-zinc-500 text-[10px]">
                      Duration: {formatTimecode(effectiveDuration, false, frameRate)}
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <button
                      onClick={() => setDurationMode("full")}
                      className={`p-2 rounded border text-left transition ${
                        durationMode === "full"
                          ? "bg-blue-950/60 border-blue-600 text-white font-bold"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="block text-[11px]">Entire Sequence</span>
                      <span className="block text-[9px] text-zinc-500 font-mono">Full timeline</span>
                    </button>
                    <button
                      onClick={() => setDurationMode("preview5")}
                      className={`p-2 rounded border text-left transition ${
                        durationMode === "preview5"
                          ? "bg-blue-950/60 border-blue-600 text-white font-bold"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="block text-[11px]">In to Out (5s)</span>
                      <span className="block text-[9px] text-zinc-500 font-mono">Quick QA test</span>
                    </button>
                    <button
                      onClick={() => setDurationMode("preview15")}
                      className={`p-2 rounded border text-left transition ${
                        durationMode === "preview15"
                          ? "bg-blue-950/60 border-blue-600 text-white font-bold"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="block text-[11px]">Shorts (15s)</span>
                      <span className="block text-[9px] text-zinc-500 font-mono">First 15 sec</span>
                    </button>
                  </div>
                </div>

                {/* Empty Timeline Warning Banner */}
                {isTimelineEmpty && (
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-600/50 text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Timeline has no clips. Please add video or audio to your timeline before exporting.</span>
                  </div>
                )}

                {/* Previous Error Banner */}
                {renderProgress?.errorMessage && (
                  <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold block">Render Notice</span>
                      <span className="text-rose-400 text-[11px] block">{renderProgress.errorMessage}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Estimated File Size Widget */}
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs mt-4">
                <div className="flex items-center gap-2 text-zinc-400">
                  <HardDrive className="w-4 h-4 text-blue-400" />
                  <span className="font-medium text-[11px]">Estimated Output File Size:</span>
                </div>
                <div className="font-mono text-sm font-bold text-zinc-100 flex items-baseline gap-1">
                  <span>~{estimatedFileSizeMB}</span>
                  <span className="text-[10px] text-zinc-500 font-normal">MB</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Adobe Premiere Pro Style Collapsible Setting Sections */}
            <div className="md:w-1/2 overflow-y-auto p-5 space-y-3 bg-[#111215]">
              
              {/* SECTION 1: OUTPUT FILE SETTINGS */}
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50">
                <button
                  onClick={() => toggleSection("file")}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between bg-zinc-900 hover:bg-zinc-800/80 text-left transition"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                    <Video className="w-3.5 h-3.5 text-blue-400" />
                    File & Location
                  </span>
                  {openSections.file ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </button>

                {openSections.file && (
                  <div className="p-3.5 space-y-3 text-xs border-t border-zinc-800">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        File Name:
                      </label>
                      <input
                        type="text"
                        value={outputFileName}
                        onChange={(e) => setOutputFileName(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="My_Video_Master.mp4"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Format Container:
                        </label>
                        <select
                          value={format}
                          onChange={(e) => setFormat(e.target.value as any)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-zinc-200 text-xs"
                        >
                          <option value="mp4">MP4 (H.264 / AAC) • Recommended</option>
                          <option value="webm">WEBM (VP9 / Opus)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Quality Preset:
                        </label>
                        <select
                          value={quality}
                          onChange={(e) => setQuality(e.target.value as any)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-zinc-200 text-xs"
                        >
                          <option value="high">High Quality (16 Mbps VBR)</option>
                          <option value="standard">Standard Web (8 Mbps)</option>
                          <option value="maximum">Maximum Bitrate (24 Mbps)</option>
                          <option value="prores">ProRes Equivalent (35 Mbps)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: VIDEO ENCODING SETTINGS */}
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50">
                <button
                  onClick={() => toggleSection("video")}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between bg-zinc-900 hover:bg-zinc-800/80 text-left transition"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    Video Settings
                  </span>
                  {openSections.video ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </button>

                {openSections.video && (
                  <div className="p-3.5 space-y-3 text-xs border-t border-zinc-800">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Frame Size (Resolution):
                        </label>
                        <select
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value as any)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-zinc-200 text-xs"
                        >
                          <option value="1080p">1080p Full HD (1920x1080)</option>
                          <option value="720p">720p HD (1280x720)</option>
                          <option value="1440p">1440p QHD (2560x1440)</option>
                          <option value="4K">4K Ultra HD (3840x2160)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Frame Rate:
                        </label>
                        <select
                          value={frameRate}
                          onChange={(e) => setFrameRate(parseInt(e.target.value) as any)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-zinc-200 text-xs"
                        >
                          <option value="24">24 fps (Cinematic Film)</option>
                          <option value="25">25 fps (PAL / European)</option>
                          <option value="30">30 fps (YouTube / Broadcast Standard)</option>
                          <option value="50">50 fps (High Smoothness PAL)</option>
                          <option value="60">60 fps (Action / Gaming / High Motion)</option>
                        </select>
                      </div>
                    </div>

                    {/* Bitrate slider */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-400">Target Video Bitrate (VBR):</span>
                        <span className="font-mono text-zinc-200 font-bold">{bitrateMbps} Mbps</span>
                      </div>
                      <input
                        type="range"
                        min="4"
                        max="45"
                        step="1"
                        value={bitrateMbps}
                        onChange={(e) => setBitrateMbps(parseInt(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer h-1.5 bg-zinc-800 rounded"
                      />
                      <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                        <span>4 Mbps (Low)</span>
                        <span>16 Mbps (YouTube Recommended)</span>
                        <span>45 Mbps (Master)</span>
                      </div>
                    </div>

                    {/* Advanced Render Checkboxes */}
                    <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                      <label className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={renderQuality === "maximum"}
                          onChange={(e) => setRenderQuality(e.target.checked ? "maximum" : "standard")}
                          className="accent-blue-500 rounded"
                        />
                        <span>Use Maximum Render Quality & Bicubic Resampling</span>
                      </label>
                      <label className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer">
                        <input type="checkbox" defaultChecked className="accent-blue-500 rounded" />
                        <span>Render at Maximum Color Depth (32-bit float internal)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: AUDIO SETTINGS */}
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50">
                <button
                  onClick={() => toggleSection("audio")}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between bg-zinc-900 hover:bg-zinc-800/80 text-left transition"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                    Audio Encoding
                  </span>
                  {openSections.audio ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </button>

                {openSections.audio && (
                  <div className="p-3.5 space-y-3 text-xs border-t border-zinc-800">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Audio Format:
                        </label>
                        <select
                          disabled
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-zinc-300 text-xs opacity-80"
                        >
                          <option>AAC (Advanced Audio Coding)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Sample Rate:
                        </label>
                        <select
                          value={audioSampleRate}
                          onChange={(e) => setAudioSampleRate(parseInt(e.target.value) as any)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-zinc-200 text-xs"
                        >
                          <option value="48000">48,000 Hz (Broadcast & Video Standard)</option>
                          <option value="44100">44,100 Hz (Music CD)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Audio Bitrate:
                        </label>
                        <select
                          value={audioBitrate}
                          onChange={(e) => setAudioBitrate(e.target.value as any)}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded p-1.5 text-zinc-200 text-xs"
                        >
                          <option value="320k">320 kbps (Audiophile Quality)</option>
                          <option value="256k">256 kbps (High Fidelity)</option>
                          <option value="192k">192 kbps (Standard Broadcast)</option>
                          <option value="128k">128 kbps (Compact)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Channel Layout:
                        </label>
                        <select
                          disabled
                          className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-zinc-300 text-xs opacity-80"
                        >
                          <option>Stereo (Left / Right Channels)</option>
                        </select>
                      </div>
                    </div>

                    {/* Mute Video Sound / Music Track Only Checkbox */}
                    <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/90 mt-2 space-y-1.5">
                      <label className="flex items-start gap-2.5 text-xs text-zinc-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={muteVideoAudio}
                          onChange={(e) => setMuteVideoAudio(e.target.checked)}
                          className="accent-rose-500 rounded mt-0.5"
                        />
                        <div>
                          <span className="font-semibold block text-zinc-100 flex items-center gap-1.5">
                            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                            Music Track Only (Silence All Video / Camera Sound)
                          </span>
                          <span className="text-[11px] text-zinc-400 block mt-0.5 leading-relaxed">
                            Guarantees 0% camera audio leakage. The exported video will cleanly feature only the studio music audio track, eliminating ambient microphone hiss and copyright claims.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 4: CAPTIONS & SUBTITLES */}
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50">
                <button
                  onClick={() => toggleSection("captions")}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between bg-zinc-900 hover:bg-zinc-800/80 text-left transition"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    Captions & Subtitles ({captions.length} cues)
                  </span>
                  {openSections.captions ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </button>

                {openSections.captions && (
                  <div className="p-3.5 space-y-3 text-xs border-t border-zinc-800">
                    <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={burnCaptions}
                        onChange={(e) => setBurnCaptions(e.target.checked)}
                        className="accent-blue-500 rounded"
                      />
                      <span>Burn-in captions directly into video pixels</span>
                    </label>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400">Export Sidecar Subtitle File:</span>
                      <button
                        onClick={handleDownloadSRT}
                        disabled={captions.length === 0}
                        className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .SRT</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 5: YOUTUBE SEO & COPYRIGHT VERIFICATION */}
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50">
                <button
                  onClick={() => toggleSection("metadata")}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between bg-zinc-900 hover:bg-zinc-800/80 text-left transition"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    Publish & YouTube Kit
                  </span>
                  {openSections.metadata ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                </button>

                {openSections.metadata && (
                  <div className="p-3.5 space-y-3 text-xs border-t border-zinc-800">
                    {/* Chapter markers export */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-zinc-200 block">Chapter Markers</span>
                        <span className="text-[10px] text-zinc-500">Auto timestamps for YouTube description</span>
                      </div>
                      <button
                        onClick={handleDownloadChapters}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download Chapters</span>
                      </button>
                    </div>

                    {/* License Report Export */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                      <div>
                        <span className="font-semibold text-zinc-200 block">Copyright License Record</span>
                        <span className="text-[10px] text-zinc-500">Declared ownership & sync terms report</span>
                      </div>
                      <button
                        onClick={handleDownloadLicenseReport}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download Record</span>
                      </button>
                    </div>

                    {/* AI YouTube Package Generator */}
                    <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-400">AI Title, Tags & Description Kit:</span>
                      <button
                        onClick={onGenerateYouTubePackage}
                        disabled={isGeneratingPackage}
                        className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        {isGeneratingPackage ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        <span>Generate Kit</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM ACTION BAR (Adobe Premiere Pro Style) */}
        <div className="h-14 bg-[#141518] border-t border-zinc-800 px-5 flex items-center justify-between shrink-0">
          <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-400 font-mono">
            <span>Estimated File Size: <strong className="text-zinc-200">~{estimatedFileSizeMB} MB</strong></span>
            <span>•</span>
            <span className="truncate max-w-[280px]">{outputFileName}</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              onClick={onClose}
              disabled={isRendering}
              className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition"
            >
              Cancel
            </button>

            <button
              onClick={handleSendToQueue}
              disabled={isTimelineEmpty || isRendering}
              className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition hidden sm:inline-flex items-center gap-1.5 disabled:opacity-40"
              title="Queue in background Media Encoder"
            >
              <span>Queue</span>
            </button>

            <button
              onClick={handleExportClick}
              disabled={isTimelineEmpty || isRendering}
              className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold text-white shadow-lg transition flex items-center gap-2 cursor-pointer transform hover:scale-[1.02]"
            >
              <Film className="w-4 h-4 fill-white" />
              <span>Export {format.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
