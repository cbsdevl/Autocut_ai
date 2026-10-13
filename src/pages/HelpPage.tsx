import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Film,
  Sparkles,
  ShieldCheck,
  Subtitles,
  Keyboard,
  Share2,
  FolderOpen,
  ArrowRight,
  HelpCircle,
  Scissors,
  CheckCircle2,
  Sliders,
  Music,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

type GuideTab = "quickstart" | "autocut" | "copyright" | "captions" | "shortcuts" | "export";

export const HelpPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<GuideTab>("quickstart");

  const SHORTCUTS = [
    { key: "Space", desc: "Play or Pause video timeline playback" },
    { key: "S", desc: "Split currently selected clip at current playhead" },
    { key: "Delete / Backspace", desc: "Remove selected clip from timeline" },
    { key: "Ctrl + Z / ⌘ + Z", desc: "Undo last timeline modification" },
    { key: "Ctrl + Shift + Z / ⌘ + Shift + Z", desc: "Redo timeline modification" },
    { key: "Ctrl + S / ⌘ + S", desc: "Manual project save" },
    { key: "M", desc: "Toggle Master Video Sound Mute" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 flex flex-col">
      {/* Top Header */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center text-zinc-950 font-bold shadow-md shadow-amber-400/20">
              <Film className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">AutoCut AI</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              to="/editor"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Studio
            </Link>
            <Link
              to="/projects"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Projects
            </Link>
            <Link
              to="/pricing"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Pricing
            </Link>
            <Link
              to="/help"
              className="px-3 py-1.5 rounded-md text-amber-400 bg-amber-400/10 font-semibold"
            >
              Guides
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/editor"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition"
          >
            <Film className="w-3.5 h-3.5" />
            Launch Studio
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold mb-3">
            <HelpCircle className="w-3.5 h-3.5" />
            Knowledge Base & Docs
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            AutoCut AI Documentation
          </h1>
          <p className="text-zinc-400 text-sm mt-1 max-w-xl">
            Everything you need to master video editing, AI automation, copyright verification, and YouTube exports.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3 mb-8">
          {[
            { id: "quickstart", label: "Quick Start", icon: Film },
            { id: "autocut", label: "AI Auto Cut", icon: Sparkles },
            { id: "copyright", label: "Copyright Safety", icon: ShieldCheck },
            { id: "captions", label: "Auto Captions", icon: Subtitles },
            { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
            { id: "export", label: "YouTube Export", icon: Share2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as GuideTab)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                  isActive
                    ? "bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/20"
                    : "bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Guide Content Panels */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 sm:p-8">
          {activeTab === "quickstart" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Film className="w-5 h-5 text-amber-400" />
                Getting Started with AutoCut AI Studio
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
                <div className="bg-zinc-950/80 p-5 rounded-xl border border-zinc-800">
                  <div className="w-7 h-7 rounded-full bg-amber-400 text-zinc-950 font-bold flex items-center justify-center mb-3">1</div>
                  <h4 className="font-bold text-white mb-1">Import Media Assets</h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Upload MP4/WebM videos, MP3 audio, and PNG/JPEG images into your media library. Drag and drop directly onto the timeline tracks.
                  </p>
                </div>
                <div className="bg-zinc-950/80 p-5 rounded-xl border border-zinc-800">
                  <div className="w-7 h-7 rounded-full bg-amber-400 text-zinc-950 font-bold flex items-center justify-center mb-3">2</div>
                  <h4 className="font-bold text-white mb-1">Arrange on Multi-Track</h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Use Track 1 for primary camera footage, Track 2 for B-roll overlays, Track 3 for background music, and Track 4 for sound effects.
                  </p>
                </div>
                <div className="bg-zinc-950/80 p-5 rounded-xl border border-zinc-800">
                  <div className="w-7 h-7 rounded-full bg-amber-400 text-zinc-950 font-bold flex items-center justify-center mb-3">3</div>
                  <h4 className="font-bold text-white mb-1">Trim & Refine</h4>
                  <p className="text-zinc-400 leading-relaxed">
                    Drag the edges of any clip to trim head/tail frames, or press <strong>S</strong> at the playhead to split into separate segments.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "autocut" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                AI Auto-Cut & Silence Trimming
              </h2>
              <p className="text-zinc-300 text-sm leading-relaxed">
                AutoCut AI features intelligent speech silence detection. It reads the audio waveform to identify dead air, filler pauses, and hesitation gaps, automatically splicing out non-speaking moments to dramatically boost video retention.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800">
                  <h4 className="font-bold text-white mb-1">Silence Sensitivity</h4>
                  <p className="text-zinc-400">
                    Adjust silence threshold from -35dB to -20dB to control how aggressively quiet room noises and pauses are removed.
                  </p>
                </div>
                <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-800">
                  <h4 className="font-bold text-white mb-1">Beat-Drop Synchronization</h4>
                  <p className="text-zinc-400">
                    When background music is active, AutoCut AI aligns video cuts and B-roll switches with the detected rhythm transients and musical drops.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "copyright" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                YouTube Content ID Safety Center
              </h2>
              <p className="text-zinc-300 text-sm leading-relaxed">
                Monetizing videos on YouTube requires clean rights. AutoCut AI performs pre-publish audits on every audio and video asset in your timeline.
              </p>
              <div className="space-y-3 text-xs sm:text-sm">
                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Low Risk:</strong> Audio sourced from the built-in Royalty-Free library or marked as creator-owned. Safe for monetization.
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Medium Risk:</strong> External tracks that require attribution or commercial license verification.
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 flex items-start gap-2.5">
                  <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>High Risk:</strong> Unverified commercial tracks known to trigger automated YouTube Content ID claims and revenue withholding.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "captions" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Subtitles className="w-5 h-5 text-amber-400" />
                Automated Animated Captions
              </h2>
              <p className="text-zinc-300 text-sm leading-relaxed">
                Generate high-energy, word-by-word subtitles styled for YouTube Shorts, Reels, and TikTok.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800">
                  <div className="font-bold text-amber-400 text-sm mb-1">YouTube</div>
                  <span className="text-zinc-400">Classic yellow emphasis</span>
                </div>
                <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800">
                  <div className="font-bold text-emerald-400 text-sm mb-1">TikTok</div>
                  <span className="text-zinc-400">Bold neon highlight</span>
                </div>
                <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800">
                  <div className="font-bold text-white text-sm mb-1">Minimal</div>
                  <span className="text-zinc-400">Clean serif typography</span>
                </div>
                <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-800">
                  <div className="font-bold text-sky-400 text-sm mb-1">Impact</div>
                  <span className="text-zinc-400">Heavy black-outlined punch</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "shortcuts" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-amber-400" />
                Editor Keyboard Shortcuts
              </h2>
              <div className="border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Shortcut Key</th>
                      <th className="py-2.5 px-4 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {SHORTCUTS.map((s, idx) => (
                      <tr key={idx} className="hover:bg-zinc-950/50">
                        <td className="py-2.5 px-4 font-mono font-bold text-amber-400">
                          {s.key}
                        </td>
                        <td className="py-2.5 px-4 text-zinc-300">
                          {s.desc}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "export" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-amber-400" />
                Export Pipeline & YouTube SEO Package
              </h2>
              <p className="text-zinc-300 text-sm leading-relaxed">
                When you export, AutoCut AI not only renders high-quality MP4 video with server-side FFmpeg or browser canvas, but also automatically generates:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-zinc-400">
                <li><strong className="text-white">Chapter Markers:</strong> Formatted timestamp list (e.g., 00:00 Intro, 01:24 Main Topic) ready to paste into your YouTube video description.</li>
                <li><strong className="text-white">Optimized Title & Tags:</strong> High-CTR suggestions tailored for YouTube search algorithms.</li>
                <li><strong className="text-white">Multi-Resolution Options:</strong> 1080p Full HD, 4K Ultra HD, and custom aspect ratios (16:9 widescreen or 9:16 vertical Shorts).</li>
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
