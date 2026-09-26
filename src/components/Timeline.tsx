import React, { useRef, useState, useEffect } from "react";
import {
  Play,
  Pause,
  Scissors,
  Copy,
  Trash2,
  ZoomIn,
  ZoomOut,
  Magnet,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Layers,
  Film,
  Music,
  Type,
  Subtitles,
  Mic,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { CaptionItem, MediaItem, TimelineClip, TimelineTrack, TrackType } from "../types";
import { formatTimecode } from "../utils/mediaUtils";

interface TimelineProps {
  tracks: TimelineTrack[];
  mediaItems: MediaItem[];
  captions: CaptionItem[];
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  onSelectClip: (clip: TimelineClip | null) => void;
  onUpdateTracks: (tracks: TimelineTrack[]) => void;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onSplitClip: (clipId: string) => void;
  onDuplicateClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  isVideoAudioMuted?: boolean;
  onToggleVideoAudioMuted?: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  tracks,
  mediaItems,
  captions,
  currentTime,
  totalDuration,
  isPlaying,
  selectedClipId,
  onSelectClip,
  onUpdateTracks,
  onSeek,
  onTogglePlay,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  isVideoAudioMuted = true,
  onToggleVideoAudioMuted,
}) => {
  const rulerRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);

  // Zoom: pixels per second (default 30px per sec)
  const [zoomLevel, setZoomLevel] = useState<number>(35);
  const [isSnapping, setIsSnapping] = useState<boolean>(true);

  // Dragging / Trimming state
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [draggingClip, setDraggingClip] = useState<{
    clipId: string;
    startClientX: number;
    initialStartTime: number;
    trackId: string;
  } | null>(null);

  const [trimmingHandle, setTrimmingHandle] = useState<{
    clipId: string;
    side: "left" | "right";
    startClientX: number;
    initialStart: number;
    initialDuration: number;
  } | null>(null);

  // Keyboard shortcuts (Spacebar, Delete, Split 'S')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === "KeyS" && selectedClipId) {
        e.preventDefault();
        onSplitClip(selectedClipId);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedClipId) {
        e.preventDefault();
        onDeleteClip(selectedClipId);
      } else if (e.code === "KeyD" && selectedClipId) {
        e.preventDefault();
        onDuplicateClip(selectedClipId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClipId, onTogglePlay, onSplitClip, onDeleteClip, onDuplicateClip]);

  // Handle Playhead Scrubbing
  const handleRulerMouseDown = (e: React.MouseEvent) => {
    setIsScrubbing(true);
    updatePlayheadFromMouseEvent(e);
  };

  const updatePlayheadFromMouseEvent = (e: React.MouseEvent | MouseEvent) => {
    if (!tracksContainerRef.current) return;
    const rect = tracksContainerRef.current.getBoundingClientRect();
    const scrollLeft = tracksContainerRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    const newTime = Math.max(0, clickX / zoomLevel);
    onSeek(newTime);
  };

  // Mouse Move & Up Listeners for dragging / trimming / scrubbing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing) {
        updatePlayheadFromMouseEvent(e);
      } else if (draggingClip) {
        const deltaX = e.clientX - draggingClip.startClientX;
        const deltaTime = deltaX / zoomLevel;
        let newStartTime = Math.max(0, draggingClip.initialStartTime + deltaTime);

        // Magnetic Snapping
        if (isSnapping) {
          // Snap to 0, current playhead, or other clip edges
          if (Math.abs(newStartTime) < 0.2) newStartTime = 0;
          if (Math.abs(newStartTime - currentTime) < 0.2) newStartTime = currentTime;
        }

        const updatedTracks = tracks.map((track) => {
          if (track.id === draggingClip.trackId) {
            return {
              ...track,
              clips: track.clips.map((c) =>
                c.id === draggingClip.clipId ? { ...c, startTime: newStartTime } : c
              ),
            };
          }
          return track;
        });
        onUpdateTracks(updatedTracks);
      } else if (trimmingHandle) {
        const deltaX = e.clientX - trimmingHandle.startClientX;
        const deltaTime = deltaX / zoomLevel;

        const updatedTracks = tracks.map((track) => {
          return {
            ...track,
            clips: track.clips.map((c) => {
              if (c.id === trimmingHandle.clipId) {
                if (trimmingHandle.side === "left") {
                  const newStart = Math.max(0, trimmingHandle.initialStart + deltaTime);
                  const durationDiff = newStart - c.startTime;
                  const newDuration = Math.max(0.3, c.duration - durationDiff);
                  return { ...c, startTime: newStart, duration: newDuration, trimStart: (c.trimStart || 0) + durationDiff };
                } else {
                  const newDuration = Math.max(0.3, trimmingHandle.initialDuration + deltaTime);
                  return { ...c, duration: newDuration };
                }
              }
              return c;
            }),
          };
        });
        onUpdateTracks(updatedTracks);
      }
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
      setDraggingClip(null);
      setTrimmingHandle(null);
    };

    if (isScrubbing || draggingClip || trimmingHandle) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isScrubbing, draggingClip, trimmingHandle, zoomLevel, tracks, isSnapping, currentTime]);

  // Drop media from library directly into timeline tracks
  const handleTrackDrop = (e: React.DragEvent, track: TimelineTrack) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const { mediaId } = JSON.parse(dataStr);
      const media = mediaItems.find((m) => m.id === mediaId);
      if (!media) return;

      const rect = tracksContainerRef.current?.getBoundingClientRect();
      const scrollLeft = tracksContainerRef.current?.scrollLeft || 0;
      const dropX = rect ? e.clientX - rect.left + scrollLeft : 0;
      const dropTime = Math.max(0, dropX / zoomLevel);

      const newClip: TimelineClip = {
        id: "clip_" + Date.now(),
        mediaId: media.id,
        trackType: track.type,
        trackId: track.id,
        startTime: dropTime,
        duration: media.duration || 5,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        volume: 1,
        label: media.name,
      };

      const updated = tracks.map((t) =>
        t.id === track.id ? { ...t, clips: [...t.clips, newClip] } : t
      );
      onUpdateTracks(updated);
      onSelectClip(newClip);
    } catch (err) {
      console.warn("Drop error:", err);
    }
  };

  // Track controls
  const toggleTrackMute = (trackId: string) => {
    onUpdateTracks(
      tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t))
    );
  };

  const toggleTrackVisibility = (trackId: string) => {
    onUpdateTracks(
      tracks.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t))
    );
  };

  const toggleTrackLock = (trackId: string) => {
    onUpdateTracks(
      tracks.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t))
    );
  };

  const timelineWidth = Math.max(1200, (totalDuration + 15) * zoomLevel);

  // Time markers on the ruler
  const stepSeconds = zoomLevel > 50 ? 1 : zoomLevel > 20 ? 2 : 5;
  const numMarkers = Math.ceil((totalDuration + 15) / stepSeconds);

  return (
    <div className="h-64 md:h-72 bg-zinc-950 border-t border-zinc-800/90 flex flex-col select-none overflow-hidden shrink-0 z-20">
      {/* Timeline Toolbar */}
      <div className="h-10 bg-zinc-900/90 border-b border-zinc-800 px-3 flex items-center justify-between text-xs">
        {/* Left: Split, Duplicate, Delete tools */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => selectedClipId && onSplitClip(selectedClipId)}
            disabled={!selectedClipId}
            title="Split Clip at Playhead (S)"
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-300 hover:text-white font-semibold transition"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span>Split (S)</span>
          </button>
          <button
            onClick={() => selectedClipId && onDuplicateClip(selectedClipId)}
            disabled={!selectedClipId}
            title="Duplicate Clip (D)"
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none text-zinc-300 hover:text-white font-semibold transition"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-400" />
            <span>Duplicate</span>
          </button>
          <button
            onClick={() => selectedClipId && onDeleteClip(selectedClipId)}
            disabled={!selectedClipId}
            title="Delete Selected Clip (Del)"
            className="p-1 rounded bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-400 disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-[1px] h-4 bg-zinc-800 mx-1.5" />

          {/* Snapping Toggle */}
          <button
            onClick={() => setIsSnapping(!isSnapping)}
            title="Toggle Magnet Snapping (N)"
            className={`p-1.5 rounded transition ${
              isSnapping
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-zinc-500 hover:text-zinc-300 bg-zinc-800"
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Playhead Timecode & Video Audio Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="font-mono text-xs font-bold text-zinc-300 flex items-center gap-2">
            <span>TIME:</span>
            <span className="text-amber-400">{formatTimecode(currentTime, true)}</span>
          </div>

          {onToggleVideoAudioMuted && (
            <button
              onClick={onToggleVideoAudioMuted}
              title="Toggle muting all video camera audio so only uploaded music plays"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold transition border cursor-pointer ${
                isVideoAudioMuted
                  ? "bg-rose-950/80 text-rose-300 border-rose-600/60 shadow-sm"
                  : "bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700/60"
              }`}
            >
              {isVideoAudioMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Video Sound: Muted (Music Only)</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Video Sound: Active</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Right: Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomLevel(Math.max(15, zoomLevel - 8))}
            className="p-1 text-zinc-400 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min="15"
            max="100"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseInt(e.target.value))}
            className="w-20 accent-amber-400 h-1 cursor-pointer"
          />
          <button
            onClick={() => setZoomLevel(Math.min(100, zoomLevel + 8))}
            className="p-1 text-zinc-400 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Timeline Workspace (Tracks Headers on left + Track Lanes on right) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Track Headers */}
        <div className="w-28 bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0 z-20">
          {/* Empty corner above tracks for the ruler */}
          <div className="h-6 bg-zinc-900 border-b border-zinc-800 px-2 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
            <span>TRACKS</span>
          </div>

          {/* Track Headers */}
          <div className="flex-1 overflow-hidden flex flex-col justify-between py-1">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="h-8 px-2 flex items-center justify-between border-b border-zinc-900/80 text-[11px] text-zinc-300 font-semibold"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                    {track.type}
                  </span>
                  <span className="truncate text-xs">{track.label}</span>
                </div>

                <div className="flex items-center gap-1 text-zinc-500">
                  {track.type.startsWith("A") ? (
                    <button
                      onClick={() => toggleTrackMute(track.id)}
                      className="hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                      title={track.muted ? "Unmute track" : "Mute track"}
                    >
                      {track.muted ? (
                        <VolumeX className="w-3 h-3 text-rose-400" />
                      ) : (
                        <Volume2 className="w-3 h-3 text-zinc-400 hover:text-zinc-200" />
                      )}
                    </button>
                  ) : track.type.startsWith("V") ? (
                    <>
                      <button
                        onClick={() => toggleTrackMute(track.id)}
                        className="hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                        title={
                          track.muted || isVideoAudioMuted
                            ? "Video sound muted - Click to unmute"
                            : "Click to mute video sound"
                        }
                      >
                        {track.muted || isVideoAudioMuted ? (
                          <VolumeX className="w-3 h-3 text-rose-400" />
                        ) : (
                          <Volume2 className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleTrackVisibility(track.id)}
                        className="hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                        title={track.visible ? "Hide track" : "Show track"}
                      >
                        {track.visible ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-zinc-600" />
                        )}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => toggleTrackVisibility(track.id)}
                      className="hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                      title={track.visible ? "Hide track" : "Show track"}
                    >
                      {track.visible ? (
                        <Eye className="w-3 h-3" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-zinc-600" />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => toggleTrackLock(track.id)}
                    className="hover:text-zinc-200"
                    title={track.locked ? "Unlock track" : "Lock track"}
                  >
                    {track.locked ? (
                      <Lock className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Unlock className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Track Lanes + Scrubbable Ruler */}
        <div
          ref={tracksContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative flex flex-col bg-zinc-950/80"
        >
          <div style={{ width: `${timelineWidth}px` }} className="relative flex-1 flex flex-col">
            {/* Top Ruler Bar */}
            <div
              ref={rulerRef}
              onMouseDown={handleRulerMouseDown}
              className="h-6 bg-zinc-900/90 border-b border-zinc-800/80 relative cursor-pointer select-none"
            >
              {Array.from({ length: numMarkers }).map((_, idx) => {
                const sec = idx * stepSeconds;
                return (
                  <div
                    key={sec}
                    className="absolute top-0 bottom-0 border-l border-zinc-800 text-[9px] font-mono text-zinc-500 pl-1 pt-0.5"
                    style={{ left: `${sec * zoomLevel}px` }}
                  >
                    {formatTimecode(sec, false)}
                  </div>
                );
              })}
            </div>

            {/* Playhead Red Cursor Line */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
              style={{ left: `${currentTime * zoomLevel}px` }}
            >
              <div className="w-3 h-3 bg-rose-500 rotate-45 -mt-1 shadow-md shadow-rose-950" />
              <div className="w-[1.5px] flex-1 bg-rose-500 shadow-sm" />
            </div>

            {/* Tracks Stack */}
            <div className="flex-1 flex flex-col justify-between py-1 relative">
              {tracks.every((t) => t.clips.length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 px-4">
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl px-4 py-2.5 text-center shadow-lg pointer-events-auto">
                    <p className="text-xs font-semibold text-zinc-300">Your timeline is empty</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Upload your videos, audio, or photos in the Media Library and drag them onto track V1/A2.
                    </p>
                  </div>
                </div>
              )}
              {tracks.map((track) => (
                <div
                  key={track.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleTrackDrop(e, track)}
                  className={`h-8 border-b border-zinc-900 relative transition ${
                    track.locked ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {/* Clips on this track */}
                  {track.clips.map((clip) => {
                    const media = mediaItems.find((m) => m.id === clip.mediaId);
                    const isSelected = selectedClipId === clip.id;
                    const clipLeft = clip.startTime * zoomLevel;
                    const clipWidth = Math.max(16, clip.duration * zoomLevel);

                    return (
                      <div
                        key={clip.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectClip(clip);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          onSelectClip(clip);
                          setDraggingClip({
                            clipId: clip.id,
                            startClientX: e.clientX,
                            initialStartTime: clip.startTime,
                            trackId: track.id,
                          });
                        }}
                        className={`absolute top-0.5 bottom-0.5 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing flex items-center justify-between text-xs transition-shadow ${
                          isSelected
                            ? "ring-2 ring-amber-400 z-10 shadow-lg"
                            : "hover:brightness-110"
                        } ${
                          track.type === "V1"
                            ? "bg-indigo-700/80 border border-indigo-500/70 text-indigo-100"
                            : track.type === "V2"
                            ? "bg-purple-700/80 border border-purple-500/70 text-purple-100"
                            : track.type === "T1"
                            ? "bg-emerald-700/80 border border-emerald-500/70 text-emerald-100"
                            : track.type === "C1"
                            ? "bg-amber-700/80 border border-amber-500/70 text-amber-100"
                            : "bg-rose-700/80 border border-rose-500/70 text-rose-100"
                        }`}
                        style={{
                          left: `${clipLeft}px`,
                          width: `${clipWidth}px`,
                        }}
                      >
                        {/* Left Trim Handle */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setTrimmingHandle({
                              clipId: clip.id,
                              side: "left",
                              startClientX: e.clientX,
                              initialStart: clip.startTime,
                              initialDuration: clip.duration,
                            });
                          }}
                          className="w-2.5 h-full bg-black/30 hover:bg-white/40 cursor-ew-resize shrink-0 flex items-center justify-center"
                          title="Trim Head"
                        />

                        {/* Clip Content (Thumbnail strip or Waveform + Label) */}
                        <div className="flex-1 min-w-0 px-2 flex items-center gap-1.5 overflow-hidden">
                          {media?.thumbnail && track.type === "V1" && (
                            <img
                              src={media.thumbnail}
                              alt=""
                              className="w-5 h-5 rounded object-cover shrink-0"
                            />
                          )}
                          <span className="text-[11px] font-bold truncate leading-none">
                            {clip.label || media?.name || "Clip"}
                          </span>
                        </div>

                        {/* Right Trim Handle */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setTrimmingHandle({
                              clipId: clip.id,
                              side: "right",
                              startClientX: e.clientX,
                              initialStart: clip.startTime,
                              initialDuration: clip.duration,
                            });
                          }}
                          className="w-2.5 h-full bg-black/30 hover:bg-white/40 cursor-ew-resize shrink-0 flex items-center justify-center"
                          title="Trim Tail"
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
