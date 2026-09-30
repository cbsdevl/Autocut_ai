import React, { useState, useRef, useEffect } from "react";
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
  MoreVertical,
  Sliders,
  Check,
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    if (showMobileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMobileMenu]);

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
    <header className="h-13 md:h-14 bg-zinc-950 border-b border-zinc-800/80 px-2 sm:px-3 flex items-center justify-between select-none z-30 shrink-0 relative">
      {/* Left: Brand + Project Title + Aspect Ratio */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 pr-1.5 sm:pr-2 border-r border-zinc-800/80 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 p-[1.5px] shadow-sm flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-[7px] flex items-center justify-center">
              <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            </div>
          </div>
          <span className="text-xs sm:text-sm font-black tracking-tight text-zinc-100 hidden xs:inline">
            AutoCut
          </span>
        </div>

        {/* Project Title Input / Display */}
        <div className="flex items-center gap-1.5 min-w-0">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              autoFocus
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 w-28 sm:w-36 md:w-44"
            />
          ) : (
            <button
              onClick={() => {
                setTitleInput(project.name);
                setIsEditingTitle(true);
              }}
              title="Click to rename project"
              className="text-xs font-semibold text-zinc-200 hover:text-white px-1.5 py-1 rounded hover:bg-zinc-900 transition truncate max-w-[90px] sm:max-w-[140px] md:max-w-[200px]"
            >
              <span className="truncate">{project.name}</span>
            </button>
          )}

          {/* Aspect Ratio Badge Selector */}
          <select
            value={project.aspectRatio}
            onChange={(e) => onUpdateProject({ aspectRatio: e.target.value as AspectRatio })}
            className="bg-zinc-900 hover:bg-zinc-850 text-[10px] sm:text-[11px] font-medium text-zinc-300 border border-zinc-800 rounded px-1.5 sm:px-2 py-1 focus:outline-none focus:border-zinc-600 transition cursor-pointer shrink-0"
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
          </select>

          {/* Resolution Badge - Desktop only */}
          <span className="hidden xl:inline text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800/80 text-zinc-400 shrink-0">
            {project.resolution} • {project.frameRate}fps
          </span>

          {/* Autosave status indicator - Desktop only */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-zinc-500 pl-1 shrink-0">
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
      <div className="flex items-center gap-0.5 sm:gap-1 bg-zinc-900/80 border border-zinc-800/80 rounded-lg p-0.5 shrink-0 mx-0.5 sm:mx-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-1.5 sm:p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition min-w-[36px] min-h-[36px] flex items-center justify-center active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="p-1.5 sm:p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition min-w-[36px] min-h-[36px] flex items-center justify-center active:scale-95"
        >
          <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Desktop extra action buttons */}
        <div className="hidden md:flex items-center">
          <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
          <button
            onClick={onOpenNewProject}
            title="New Project"
            className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 px-2 py-1 rounded transition min-h-[32px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
          {onClearAllData && (
            <button
              onClick={onClearAllData}
              title="Clear All Data (Blank Workspace)"
              className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-1 rounded transition min-h-[32px]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Right: AI Auto Edit + Export Button + Mobile Menu */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Copyright Safety Badge Button - Desktop only */}
        <button
          onClick={() => onSelectTab("copyright")}
          className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-lg border transition ${
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
              <span className="hidden md:inline">Copyright Warning</span>
            </>
          ) : hasMediumRisk ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Verify Rights</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Copyright Safety</span>
            </>
          )}
        </button>

        {/* AI Auto Edit Button */}
        <button
          onClick={onOpenAIAutoEdit}
          className="flex items-center gap-1 text-xs font-bold px-2 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:via-rose-400 hover:to-indigo-500 text-white shadow-md shadow-rose-950/50 transition cursor-pointer min-h-[36px] active:scale-95"
          title="Run AI Automatic Editing"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-200 fill-amber-200 animate-pulse shrink-0" />
          <span className="hidden sm:inline">AI Auto Cut</span>
        </button>

        {/* Export for YouTube Button */}
        <button
          onClick={onOpenExport}
          className="flex items-center gap-1 text-xs font-bold px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 shadow transition cursor-pointer min-h-[36px] active:scale-95"
          title="Export Video for YouTube"
        >
          <Download className="w-3.5 h-3.5 text-zinc-950 stroke-[2.5]" />
          <span>Export</span>
        </button>

        {/* Mobile Overflow Menu Toggle */}
        <div className="relative md:hidden" ref={menuRef}>
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition min-w-[36px] min-h-[36px] flex items-center justify-center active:scale-95"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMobileMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1.5 z-50 text-xs">
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenNewProject();
                }}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>New Project</span>
              </button>

              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenAIAutoEdit();
                }}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>AI Auto Cut & Remix</span>
              </button>

              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenQualityCheck();
                }}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                <span>AI Quality Check</span>
              </button>

              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onSelectTab("copyright");
                }}
                className="w-full text-left px-3 py-2.5 text-zinc-200 hover:bg-zinc-800 flex items-center gap-2.5"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Copyright Safety Center</span>
              </button>

              {onClearAllData && (
                <>
                  <div className="h-[1px] bg-zinc-800 my-1" />
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      onClearAllData();
                    }}
                    className="w-full text-left px-3 py-2.5 text-rose-400 hover:bg-rose-950/40 flex items-center gap-2.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Workspace</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
