import React from "react";
import {
  Sliders,
  Scissors,
  Copy,
  Trash2,
  Volume2,
  Gauge,
  ZoomIn,
  Crop,
  Layers,
  Sparkles,
  Info,
  Film,
} from "lucide-react";
import { MediaItem, ProjectSettings, TimelineClip, TimelineTrack } from "../types";
import { formatTimecode } from "../utils/mediaUtils";

interface InspectorProps {
  selectedClip: TimelineClip | null;
  mediaItems: MediaItem[];
  project: ProjectSettings;
  currentTime: number;
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void;
  onSplitClip: (clipId: string) => void;
  onDuplicateClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onUpdateProject: (updates: Partial<ProjectSettings>) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  selectedClip,
  mediaItems,
  project,
  currentTime,
  onUpdateClip,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  onUpdateProject,
}) => {
  const media = selectedClip ? mediaItems.find((m) => m.id === selectedClip.mediaId) : null;

  if (!selectedClip) {
    return (
      <div className="w-72 bg-zinc-950 border-l border-zinc-800/80 p-3.5 flex flex-col h-full select-none shrink-0 overflow-y-auto">
        <div className="flex items-center gap-1.5 pb-3 border-b border-zinc-800">
          <Film className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Project Inspector</h3>
        </div>

        <div className="space-y-4 py-4 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Canvas Aspect Ratio:</label>
            <select
              value={project.aspectRatio}
              onChange={(e) => onUpdateProject({ aspectRatio: e.target.value as any })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 focus:outline-none"
            >
              <option value="16:9">16:9 (YouTube Standard)</option>
              <option value="9:16">9:16 (YouTube Shorts & TikTok)</option>
              <option value="1:1">1:1 (Square Social)</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Export Resolution:</label>
            <select
              value={project.resolution}
              onChange={(e) => onUpdateProject({ resolution: e.target.value as any })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 focus:outline-none"
            >
              <option value="1080p">1080p (Full HD)</option>
              <option value="1440p">1440p (2K Quad HD)</option>
              <option value="4K">4K (Ultra HD)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Project Frame Rate:</label>
            <select
              value={project.frameRate}
              onChange={(e) => onUpdateProject({ frameRate: parseInt(e.target.value) as any })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 focus:outline-none"
            >
              <option value="24">24 fps (Cinematic Film)</option>
              <option value="25">25 fps (PAL Broadcast)</option>
              <option value="30">30 fps (Standard Web)</option>
              <option value="50">50 fps (European High Motion)</option>
              <option value="60">60 fps (Smooth Gaming/Action)</option>
            </select>
          </div>

          <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2">
            <span className="text-[11px] font-bold text-zinc-300 block">Editing Style:</span>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-amber-300">{project.stylePreset || "Cinematic"}</span>
            </div>
            <p className="text-[10px] text-zinc-500">
              Pacing, transitions, captions, and color treatment tuned to this aesthetic.
            </p>
          </div>

          <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/80 text-[10.5px] text-zinc-400 space-y-1">
            <span className="font-semibold text-zinc-300 block">Tip:</span>
            <p>Select any clip on the multi-track timeline below to inspect and customize its volume, speed, trim points, and color grading.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 bg-zinc-950 border-l border-zinc-800/80 p-3.5 flex flex-col h-full select-none shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider truncate">
            Clip Inspector
          </h3>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
          {selectedClip.trackType}
        </span>
      </div>

      <div className="space-y-4 py-3 text-xs">
        {/* Clip Title & Media Source */}
        <div>
          <h4 className="font-bold text-zinc-100 truncate">{selectedClip.label || media?.name || "Timeline Clip"}</h4>
          {media && (
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Source: {media.format.toUpperCase()} • Duration: {formatTimecode(selectedClip.duration, false)}
            </p>
          )}
        </div>

        {/* Quick Clip Operations: Split, Duplicate, Delete */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onSplitClip(selectedClip.id)}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg flex flex-col items-center gap-1 text-zinc-300 hover:text-white transition"
            title="Split clip at playhead"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-semibold">Split</span>
          </button>
          <button
            onClick={() => onDuplicateClip(selectedClip.id)}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg flex flex-col items-center gap-1 text-zinc-300 hover:text-white transition"
            title="Duplicate clip"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-semibold">Duplicate</span>
          </button>
          <button
            onClick={() => onDeleteClip(selectedClip.id)}
            className="p-2 bg-zinc-900 hover:bg-rose-950/40 border border-zinc-800 hover:border-rose-800/60 rounded-lg flex flex-col items-center gap-1 text-zinc-400 hover:text-rose-400 transition"
            title="Delete clip"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold">Delete</span>
          </button>
        </div>

        {/* Speed Control */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
              <Gauge className="w-3.5 h-3.5 text-indigo-400" /> Playback Speed
            </span>
            <span className="font-mono text-zinc-400">{selectedClip.speed || 1}x</span>
          </div>
          <div className="flex items-center gap-1">
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
              <button
                key={s}
                onClick={() => onUpdateClip(selectedClip.id, { speed: s })}
                className={`flex-1 py-1 rounded text-[10px] font-mono transition ${
                  (selectedClip.speed || 1) === s
                    ? "bg-indigo-600 text-white font-bold"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Volume & Audio Ducking */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> Volume
            </span>
            <span className="font-mono text-zinc-400">{Math.round((selectedClip.volume ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={selectedClip.volume ?? 1}
            onChange={(e) => onUpdateClip(selectedClip.id, { volume: parseFloat(e.target.value) })}
            className="w-full accent-emerald-400 cursor-pointer"
          />
          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedClip.ducking ?? false}
              onChange={(e) => onUpdateClip(selectedClip.id, { ducking: e.target.checked })}
              className="rounded accent-amber-500"
            />
            <span className="text-[10px] text-zinc-400">Auto-duck volume under speech</span>
          </label>
        </div>

        {/* Zoom Scale */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
              <ZoomIn className="w-3.5 h-3.5 text-amber-400" /> Cinematic Zoom
            </span>
            <span className="font-mono text-zinc-400">{((selectedClip.zoom || 1) * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="1.6"
            step="0.02"
            value={selectedClip.zoom || 1}
            onChange={(e) => onUpdateClip(selectedClip.id, { zoom: parseFloat(e.target.value) })}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        {/* Reframe Mode */}
        <div className="space-y-1.5">
          <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
            <Crop className="w-3.5 h-3.5 text-rose-400" /> Reframe / Focal Point
          </span>
          <select
            value={selectedClip.reframe || "center"}
            onChange={(e) => onUpdateClip(selectedClip.id, { reframe: e.target.value as any })}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 focus:outline-none text-xs"
          >
            <option value="center">Center Crop</option>
            <option value="face_focus">AI Face / Speaker Focus</option>
            <option value="fit">Fit Whole Frame (Letterbox)</option>
          </select>
        </div>

        {/* Transitions */}
        <div className="space-y-1.5">
          <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Transition In
          </span>
          <select
            value={selectedClip.transitionIn || "None"}
            onChange={(e) => onUpdateClip(selectedClip.id, { transitionIn: e.target.value as any })}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-200 focus:outline-none text-xs"
          >
            <option value="None">None (Hard Cut)</option>
            <option value="Crossfade">Crossfade (Dissolve)</option>
            <option value="Dip to Black">Dip to Black</option>
            <option value="Zoom In">Dynamic Zoom In</option>
            <option value="Slide">Slide</option>
            <option value="Wipe">Wipe</option>
            <option value="Glitch">Glitch</option>
          </select>
        </div>
      </div>
    </div>
  );
};
