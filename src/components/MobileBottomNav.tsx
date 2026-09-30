import React from "react";
import {
  Film,
  Music,
  Type,
  Sparkles,
  Sliders,
  FolderOpen,
  Subtitles,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { MediaItem } from "../types";

export type MobileTab =
  | "studio"
  | "media"
  | "audio"
  | "text"
  | "captions"
  | "effects"
  | "inspector"
  | "copyright";

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  mediaItems: MediaItem[];
  hasSelectedClip: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  mediaItems,
  hasSelectedClip,
}) => {
  const hasRisk = mediaItems.some(
    (m) => m.riskLevel === "High" || m.riskLevel === "Medium"
  );

  const tabs: {
    id: MobileTab;
    label: string;
    icon: React.ReactNode;
    badge?: boolean;
    badgeColor?: string;
  }[] = [
    {
      id: "studio",
      label: "Studio",
      icon: <Film className="w-5 h-5" />,
    },
    {
      id: "media",
      label: "Media",
      icon: <FolderOpen className="w-5 h-5" />,
      badge: hasRisk,
      badgeColor: "bg-amber-500",
    },
    {
      id: "audio",
      label: "Audio",
      icon: <Music className="w-5 h-5" />,
    },
    {
      id: "text",
      label: "Text",
      icon: <Type className="w-5 h-5" />,
    },
    {
      id: "captions",
      label: "Captions",
      icon: <Subtitles className="w-5 h-5" />,
    },
    {
      id: "effects",
      label: "Effects",
      icon: <Sparkles className="w-5 h-5" />,
    },
    {
      id: "inspector",
      label: "Inspect",
      icon: <Sliders className="w-5 h-5" />,
      badge: hasSelectedClip,
      badgeColor: "bg-amber-400",
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800/80 px-1 py-1 flex items-center justify-around select-none shadow-2xl"
      style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex-1 min-h-[48px] py-1 px-0.5 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all relative ${
              isActive
                ? "text-amber-400 font-bold"
                : "text-zinc-400 hover:text-zinc-200 active:scale-95"
            }`}
          >
            <div className="relative">
              {tab.icon}
              {tab.badge && (
                <span
                  className={`absolute -top-0.5 -right-1 w-2 h-2 rounded-full ${
                    tab.badgeColor || "bg-amber-500"
                  } ring-2 ring-zinc-950 animate-pulse`}
                />
              )}
            </div>
            <span className="text-[10px] tracking-tight leading-none text-center">
              {tab.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0.5 w-4 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
