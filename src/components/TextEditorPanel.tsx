import React, { useState } from "react";
import { Type, Plus, AlignCenter, Palette, Sparkles, Check } from "lucide-react";
import { TextStyle, TimelineClip } from "../types";

interface TextEditorPanelProps {
  onAddTextToTimeline: (text: string, style: TextStyle) => void;
  selectedClip: TimelineClip | null;
  onUpdateSelectedClip: (updates: Partial<TimelineClip>) => void;
}

export const TextEditorPanel: React.FC<TextEditorPanelProps> = ({
  onAddTextToTimeline,
  selectedClip,
  onUpdateSelectedClip,
}) => {
  const [inputText, setInputText] = useState("NEW TITLE");
  const [fontSize, setFontSize] = useState(28);
  const [fontColor, setFontColor] = useState("#ffffff");
  const [bgColor, setBgColor] = useState("rgba(0, 0, 0, 0.65)");
  const [positionY, setPositionY] = useState(50); // percentage
  const [positionX, setPositionX] = useState(50);

  const presets = [
    {
      name: "YouTube Main Title",
      text: "ULTIMATE GUIDE",
      style: {
        fontFamily: "Inter, sans-serif",
        fontSize: 36,
        color: "#ffffff",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        positionX: 50,
        positionY: 50,
      },
    },
    {
      name: "Lower Third Nameplate",
      text: "Alex Rivera | Travel Filmmaker",
      style: {
        fontFamily: "sans-serif",
        fontSize: 20,
        color: "#ffffff",
        backgroundColor: "rgba(24, 24, 27, 0.85)",
        positionX: 50,
        positionY: 82,
      },
    },
    {
      name: "Subscribe CTA",
      text: "🔔 Subscribe & Like the Video!",
      style: {
        fontFamily: "sans-serif",
        fontSize: 22,
        color: "#fef08a",
        backgroundColor: "rgba(225, 29, 72, 0.9)",
        positionX: 50,
        positionY: 85,
      },
    },
    {
      name: "Cinematic Header",
      text: "PART ONE • THE JOURNEY",
      style: {
        fontFamily: "serif",
        fontSize: 26,
        color: "#f4f4f5",
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        positionX: 50,
        positionY: 30,
      },
    },
    {
      name: "Social Handle Badge",
      text: "@AutoCutAI #Creator",
      style: {
        fontFamily: "sans-serif",
        fontSize: 18,
        color: "#38bdf8",
        backgroundColor: "rgba(15, 23, 42, 0.8)",
        positionX: 50,
        positionY: 15,
      },
    },
  ];

  const handleAdd = () => {
    if (!inputText.trim()) return;
    onAddTextToTimeline(inputText.trim(), {
      fontFamily: "sans-serif",
      fontSize,
      color: fontColor,
      backgroundColor: bgColor,
      positionX,
      positionY,
    });
  };

  const handleUsePreset = (preset: typeof presets[0]) => {
    onAddTextToTimeline(preset.text, preset.style);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/60 border-r border-zinc-800/80 w-80 md:w-96 select-none shrink-0 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-amber-400" />
            Titles & Graphic Overlays
          </h2>
          <p className="text-[10px] text-zinc-500">Lower thirds, headlines, and call-to-actions</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {/* Presets List */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
            Click Preset to Add to Track T1:
          </label>
          <div className="space-y-2">
            {presets.map((p, idx) => (
              <div
                key={idx}
                className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl p-2.5 flex items-center justify-between group transition"
              >
                <div>
                  <h4 className="font-bold text-zinc-200 text-xs">{p.name}</h4>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{p.text}</p>
                </div>
                <button
                  onClick={() => handleUsePreset(p)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-300 text-xs font-bold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Text Creator */}
        <div className="p-3 bg-zinc-950 border border-zinc-800/90 rounded-xl space-y-3">
          <span className="text-[11px] font-bold text-zinc-300 block">Custom Text Box:</span>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your title text..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-100 font-bold focus:outline-none focus:border-amber-500 text-xs"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-0.5">Font Size ({fontSize}px)</label>
              <input
                type="range"
                min="14"
                max="60"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-0.5">Vertical Position ({positionY}%)</label>
              <input
                type="range"
                min="10"
                max="90"
                value={positionY}
                onChange={(e) => setPositionY(parseInt(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-0.5">Text Color</label>
              <input
                type="color"
                value={fontColor}
                onChange={(e) => setFontColor(e.target.value)}
                className="w-full h-7 bg-zinc-900 border border-zinc-800 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-0.5">Background Box</label>
              <select
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded p-1 text-zinc-300 text-xs h-7"
              >
                <option value="rgba(0, 0, 0, 0.7)">Dark Box</option>
                <option value="rgba(225, 29, 72, 0.85)">Red Banner</option>
                <option value="rgba(14, 165, 233, 0.85)">Sky Banner</option>
                <option value="transparent">No Background</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleAdd}
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg transition text-xs flex items-center justify-center gap-1.5 shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add to Timeline (T1)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
