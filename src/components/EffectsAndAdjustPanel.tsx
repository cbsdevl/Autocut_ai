import React from "react";
import {
  Sparkles,
  Sliders,
  Layers,
  Wand2,
  Sun,
  Contrast,
  Droplets,
  Thermometer,
  CircleDot,
  Check,
  Zap,
  Scissors,
  UserCheck,
  Volume2,
  ChevronLeft,
} from "lucide-react";
import { TimelineClip } from "../types";

interface EffectsAndAdjustPanelProps {
  type: "transitions" | "effects" | "adjust" | "ai_tools";
  selectedClip: TimelineClip | null;
  onUpdateSelectedClip: (updates: Partial<TimelineClip>) => void;
  onApplyPresetToAll: (lut: string) => void;
  onRunSilenceCut: () => void;
  onRunFaceReframe: () => void;
  onRunAudioNormalize: () => void;
  onBackToStudio?: () => void;
}

export const EffectsAndAdjustPanel: React.FC<EffectsAndAdjustPanelProps> = ({
  type,
  selectedClip,
  onUpdateSelectedClip,
  onApplyPresetToAll,
  onRunSilenceCut,
  onRunFaceReframe,
  onRunAudioNormalize,
  onBackToStudio,
}) => {
  const transitionsList = [
    { id: "None", name: "Cut (None)", desc: "Standard instantaneous jump" },
    { id: "Crossfade", name: "Crossfade (Dissolve)", desc: "Smooth gradual blend between scenes" },
    { id: "Dip to Black", name: "Dip to Black", desc: "Fade to black then fade in, cinematic pause" },
    { id: "Zoom In", name: "Dynamic Zoom In", desc: "Punch-in camera motion into next scene" },
    { id: "Slide", name: "Whip Slide", desc: "Horizontal rapid wipe" },
    { id: "Wipe", name: "Geometric Wipe", desc: "Linear reveal wipe" },
    { id: "Glitch", name: "Digital Glitch", desc: "Cyber chromatic aberration glitch" },
  ];

  const colorLuts = [
    { id: "natural", name: "Natural Film", desc: "Balanced skin tones and true whites", b: 1, c: 1.05, s: 1.05, temp: 0, v: 0 },
    { id: "cinematic", name: "Cinematic Teal & Orange", desc: "Hollywood blockbuster aesthetic", b: 1.02, c: 1.15, s: 1.18, temp: -5, v: 0.25 },
    { id: "vivid", name: "YouTube Vivid Pop", desc: "Scroll-stopping saturation and high contrast", b: 1.05, c: 1.12, s: 1.3, temp: 5, v: 0.1 },
    { id: "warm_amber", name: "Golden Hour Glow", desc: "Sunset warmth for travel and romance", b: 1.03, c: 1.08, s: 1.2, temp: 15, v: 0.15 },
    { id: "dramatic_bw", name: "Dramatic Noir B&W", desc: "High-contrast monochrome", b: 0.98, c: 1.35, s: 0, temp: 0, v: 0.35 },
    { id: "neon", name: "Cyber Neon", desc: "Vibrant gaming and music video edge", b: 1.08, c: 1.22, s: 1.45, temp: -15, v: 0.2 },
  ];

  const filter = selectedClip?.filter || {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    temperature: 0,
    vignette: 0,
  };

  const handleSliderChange = (key: keyof typeof filter, value: number) => {
    if (!selectedClip) return;
    onUpdateSelectedClip({
      filter: {
        ...filter,
        [key]: value,
      },
    });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/60 border-r border-zinc-800/80 w-full md:w-80 lg:w-96 select-none shrink-0 overflow-hidden">
      {/* Header */}
      <div className="p-2.5 sm:p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBackToStudio && (
            <button
              onClick={onBackToStudio}
              className="md:hidden flex items-center gap-0.5 text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-lg border border-amber-500/30 transition active:scale-95 min-h-[32px]"
              title="Return to Studio (Preview Player & Timeline)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Studio</span>
            </button>
          )}
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            {type === "transitions" ? (
              <>
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Transitions
              </>
            ) : type === "effects" ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Video Effects & LUTs
              </>
            ) : type === "adjust" ? (
              <>
                <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Color Grading & Adjust
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5 text-rose-400" /> AI Video Tools
              </>
            )}
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* TRANSITIONS PANEL */}
        {type === "transitions" && (
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-400">
              {selectedClip
                ? `Assign transition to selected clip (${selectedClip.label || "Clip"}):`
                : "Select a clip on the timeline to set transitions, or click below to set default:"}
            </p>

            <div className="space-y-2">
              {transitionsList.map((tr) => {
                const isSelected = selectedClip?.transitionIn === tr.id;
                return (
                  <button
                    key={tr.id}
                    onClick={() => {
                      if (selectedClip) {
                        onUpdateSelectedClip({ transitionIn: tr.id as any, transitionOut: tr.id as any });
                      }
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition ${
                      isSelected
                        ? "bg-zinc-800 border-indigo-500 text-indigo-200"
                        : "bg-zinc-950/80 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold">{tr.name}</h4>
                      <p className="text-[10px] text-zinc-500">{tr.desc}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* EFFECTS & LUTS PANEL */}
        {type === "effects" && (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-400">
              Select a cinematic color grade to apply to the active clip or entire project:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {colorLuts.map((lut) => (
                <button
                  key={lut.id}
                  onClick={() => {
                    if (selectedClip) {
                      onUpdateSelectedClip({
                        filter: {
                          brightness: lut.b,
                          contrast: lut.c,
                          saturation: lut.s,
                          temperature: lut.temp,
                          vignette: lut.v,
                          lut: lut.id,
                        },
                      });
                    } else {
                      onApplyPresetToAll(lut.id);
                    }
                  }}
                  className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 p-2.5 rounded-xl text-left transition space-y-1 group"
                >
                  <div className="h-10 rounded-lg bg-zinc-900 overflow-hidden relative border border-zinc-800">
                    <div
                      className="w-full h-full"
                      style={{
                        background:
                          lut.id === "cinematic"
                            ? "linear-gradient(135deg, #0d9488 0%, #ea580c 100%)"
                            : lut.id === "vivid"
                            ? "linear-gradient(135deg, #e11d48 0%, #f59e0b 100%)"
                            : lut.id === "dramatic_bw"
                            ? "linear-gradient(135deg, #18181b 0%, #d4d4d8 100%)"
                            : lut.id === "warm_amber"
                            ? "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)"
                            : lut.id === "neon"
                            ? "linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)"
                            : "linear-gradient(135deg, #52525b 0%, #a1a1aa 100%)",
                        opacity: 0.75,
                      }}
                    />
                  </div>
                  <h4 className="text-xs font-bold text-zinc-200 group-hover:text-white truncate">
                    {lut.name}
                  </h4>
                  <p className="text-[9px] text-zinc-500 line-clamp-1">{lut.desc}</p>
                </button>
              ))}
            </div>

            <button
              onClick={() => onApplyPresetToAll("cinematic")}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 rounded-lg transition"
            >
              Apply Cinematic LUT to All Clips
            </button>
          </div>
        )}

        {/* ADJUST PANEL */}
        {type === "adjust" && (
          <div className="space-y-4">
            {!selectedClip ? (
              <div className="p-4 text-center border border-dashed border-zinc-800 rounded-xl">
                <Sliders className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-zinc-300">Select a clip to adjust</p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Click on any video or image clip in the timeline to adjust lighting and color sliders.
                </p>
              </div>
            ) : (
              <>
                {/* Brightness */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                      <Sun className="w-3.5 h-3.5 text-amber-400" /> Brightness
                    </span>
                    <span className="font-mono text-zinc-400 text-[11px]">
                      {Math.round(filter.brightness * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={filter.brightness}
                    onChange={(e) => handleSliderChange("brightness", parseFloat(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                {/* Contrast */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                      <Contrast className="w-3.5 h-3.5 text-indigo-400" /> Contrast
                    </span>
                    <span className="font-mono text-zinc-400 text-[11px]">
                      {Math.round(filter.contrast * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.6"
                    step="0.05"
                    value={filter.contrast}
                    onChange={(e) => handleSliderChange("contrast", parseFloat(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                </div>

                {/* Saturation */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                      <Droplets className="w-3.5 h-3.5 text-rose-400" /> Saturation
                    </span>
                    <span className="font-mono text-zinc-400 text-[11px]">
                      {Math.round(filter.saturation * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2.0"
                    step="0.05"
                    value={filter.saturation}
                    onChange={(e) => handleSliderChange("saturation", parseFloat(e.target.value))}
                    className="w-full accent-rose-400 cursor-pointer"
                  />
                </div>

                {/* Vignette */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
                      <CircleDot className="w-3.5 h-3.5 text-zinc-400" /> Vignette Shadow
                    </span>
                    <span className="font-mono text-zinc-400 text-[11px]">
                      {Math.round((filter.vignette || 0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={filter.vignette || 0}
                    onChange={(e) => handleSliderChange("vignette", parseFloat(e.target.value))}
                    className="w-full accent-zinc-400 cursor-pointer"
                  />
                </div>

                {/* Reset Button */}
                <button
                  onClick={() =>
                    onUpdateSelectedClip({
                      filter: { brightness: 1, contrast: 1, saturation: 1, temperature: 0, vignette: 0 },
                    })
                  }
                  className="w-full py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 rounded-lg transition"
                >
                  Reset Color Adjustments
                </button>
              </>
            )}
          </div>
        )}

        {/* AI TOOLS PANEL */}
        {type === "ai_tools" && (
          <div className="space-y-2.5">
            <p className="text-[11px] text-zinc-400">
              One-click specialized AI automation tools:
            </p>

            <button
              onClick={onRunSilenceCut}
              className="w-full p-3 bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 rounded-xl text-left transition space-y-1 group"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 group-hover:text-amber-400">
                <Scissors className="w-4 h-4 text-amber-400" />
                <span>Auto Silence & Dead-Air Remover</span>
              </div>
              <p className="text-[10px] text-zinc-500">
                Detects pauses over 0.6s and trims empty gaps for ultra-crisp YouTube Vlog pacing.
              </p>
            </button>

            <button
              onClick={onRunFaceReframe}
              className="w-full p-3 bg-zinc-950 border border-zinc-800 hover:border-indigo-500/50 rounded-xl text-left transition space-y-1 group"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 group-hover:text-indigo-400">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                <span>Smart Face-Centering & Auto-Reframe</span>
              </div>
              <p className="text-[10px] text-zinc-500">
                Maintains face and speaker focus when converting 16:9 widescreen footage into 9:16 Shorts.
              </p>
            </button>

            <button
              onClick={onRunAudioNormalize}
              className="w-full p-3 bg-zinc-950 border border-zinc-800 hover:border-emerald-500/50 rounded-xl text-left transition space-y-1 group"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 group-hover:text-emerald-400">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Audio Loudness Normalization & Ducking</span>
              </div>
              <p className="text-[10px] text-zinc-500">
                Balances voice peaks to -14 LUFS standard and ducks background music under spoken words.
              </p>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
