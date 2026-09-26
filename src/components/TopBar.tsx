import React, { useState } from "react";
import {
  Sparkles,
  Download,
  RotateCcw,
  RotateCw,
  FolderOpen,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Save,
  CheckCircle2,
  Film,
  Settings,
  HelpCircle,
  Trash2,
} from "lucide-react";
import { AspectRatio, MediaItem, ProjectSettings } from "../types";

interface TopBarProps {
  project: ProjectSettings;
  onUpdateProject: (updated: Partial<ProjectSettings>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenAIAutoEdit: () => void;
  onOpenExport: () => void;
  onOpenNewProject: () => void;
  onOpenQualityCheck: () => void;
  onSelectTab: (tab: string) => void;
  onClearAllData?: () => void;
  mediaItems: MediaItem[];
  isSaving: boolean;
  lastSavedText: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  onUpdateProject,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenAIAutoEdit,
  onOpenExport,
  onOpenNewProject,
  onOpenQualityCheck,
  onSelectTab,
  onClearAllData,
  mediaItems,
  isSaving,
  lastSavedText,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(project.name);

  // Calculate copyright risk indicator
  const hasHighRisk = mediaItems.some((m) => m.riskLevel === "High");
  const hasMediumRisk = mediaItems.some((m) => m.riskLevel === "Medium");

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onUpdateProject({ name: titleInput.trim() });
    } else {
      setTitleInput(project.name);
    }
  };

  return (
    <header className="h-14 bg-zinc-950 border-b border-zinc-800/80 px-3 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Brand + Project Name + Project Actions */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 pr-2 border-r border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 p-[1.5px] shadow-sm flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-[7px] flex items-center justify-center">
              <Film className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="leading-tight">
            <span className="text-sm font-black tracking-tight text-zinc-100 flex items-center gap-1.5">
              AutoCut <span className="text-xs px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">AI</span>
            </span>
          </div>
        </div>

        {/* Project Title Input */}
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              autoFocus
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              className="bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-100 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 max-w-[200px]"
            />
          ) : (
            <button
              onClick={() => {
                setTitleInput(project.name);
                setIsEditingTitle(true);
              }}
              title="Click to rename project"
              className="text-xs font-semibold text-zinc-200 hover:text-white px-2 py-1 rounded hover:bg-zinc-900 transition flex items-center gap-1.5 max-w-[220px] truncate"
            >
              <span className="truncate">{project.name}</span>
            </button>
          )}

          {/* Aspect Ratio Badge Selector */}
          <select
            value={project.aspectRatio}
            onChange={(e) => onUpdateProject({ aspectRatio: e.target.value as AspectRatio })}
            className="bg-zinc-900 hover:bg-zinc-850 text-[11px] font-medium text-zinc-300 border border-zinc-800 rounded px-2 py-1 focus:outline-none focus:border-zinc-600 transition cursor-pointer"
          >
            <option value="16:9">16:9 (YouTube Landscape)</option>
            <option value="9:16">9:16 (Shorts & Reels)</option>
            <option value="1:1">1:1 (Square)</option>
            <option value="custom">Custom</option>
          </select>

          {/* Resolution Badge */}
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800/80 text-zinc-400">
            {project.resolution} • {project.frameRate}fps
          </span>

          {/* Autosave status indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-zinc-500 pl-2">
            {isSaving ? (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-zinc-400">
                <CheckCircle2 className="w-3 h-3 text-emerald-500/80" />
                {lastSavedText}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Undo/Redo & Quick Actions */}
      <div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800/80 rounded-lg p-0.5">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
        <button
          onClick={onOpenNewProject}
          title="New Project"
          className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 px-2 py-1 rounded transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden md:inline">New</span>
        </button>
        {onClearAllData && (
          <button
            onClick={onClearAllData}
            title="Clear All Data (Blank Workspace)"
            className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-1 rounded transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Right: Copyright Safety Status + AI Auto Edit + Export Button */}
      <div className="flex items-center gap-2">
        {/* Copyright Safety Badge Button */}
        <button
          onClick={() => onSelectTab("copyright")}
          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition ${
            hasHighRisk
              ? "bg-rose-950/40 border-rose-600/60 text-rose-300 hover:bg-rose-900/50"
              : hasMediumRisk
              ? "bg-amber-950/40 border-amber-600/60 text-amber-300 hover:bg-amber-900/50"
              : "bg-emerald-950/30 border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/40"
          }`}
          title="Open Copyright Safety Center"
        >
          {hasHighRisk ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span className="hidden sm:inline">Copyright Warning</span>
            </>
          ) : hasMediumRisk ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Verify Rights</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Copyright Safety</span>
            </>
          )}
        </button>

        {/* AI Auto Edit Button */}
        <button
          onClick={onOpenAIAutoEdit}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:via-rose-400 hover:to-indigo-500 text-white shadow-md shadow-rose-950/50 transition cursor-pointer"
          title="Run AI Automatic Editing"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-200 fill-amber-200 animate-pulse" />
          <span>AI Auto Edit</span>
        </button>

        {/* Export for YouTube Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 shadow transition cursor-pointer"
          title="Export Video for YouTube"
        >
          <Download className="w-3.5 h-3.5 text-zinc-950 stroke-[2.5]" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
