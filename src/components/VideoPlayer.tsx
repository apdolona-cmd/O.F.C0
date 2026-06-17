import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, PictureInPicture2,
  AlertCircle, Gauge, Check, ChevronDown,
} from "lucide-react";
import type { VideoMeta, SiteSettings } from "../lib/db";
import { getVideoUrl, incrementViews, formatDuration, formatBytes, formatDate, formatViews } from "../lib/db";

interface Props {
  video: VideoMeta | null;
  settings: SiteSettings;
  onClose: () => void;
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function VideoPlayer({ video, settings, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef(0);
  
  const [loading, setLoading] = useState(true);
  const [loadPct, setLoadPct] = useState(0);
  const [error, setError] = useState("");
  
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [buf, setBuf] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [controls, setControls] = useState(true);
  const [speedMenu, setSpeedMenu] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pip, setPip] = useState(false);

  // ── Load video ──
  useEffect(() => {
    setLoading(true);
    setError("");
    setPlaying(false);
    setTime(0);
    setDur(0);
    setBuf(0);
    setSpeed(1);
    setSpeedMenu(false);
    setLoadPct(0);

    if (!video) { setLoading(false); return; }

    getVideoUrl(video.id, video.fileType, setLoadPct)
      .then((url) => {
        if (videoRef.current) {
          videoRef.current.src = url;
          videoRef.current.load();
        }
        incrementViews(video.id);
      })
      .catch((err) => {
        setError(err.message || "فشل تحميل الفيديو");
        setLoading(false);
      });
  }, [video]);

  // ── Video events ──
  const onLoaded = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setDur(v.duration);
    setLoading(false);
    v.play().catch(() => setPlaying(false));
  }, []);

  const onTimeUpd = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setTime(v.currentTime);
    if (v.buffered.length > 0) setBuf(v.buffered.end(v.buffered.length - 1));
  }, []);

  // ── Controls ──
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(console.error);
    else v.pause();
  }, []);

  const skip = useCallback((s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + s));
  }, []);

  const doSetVol = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const nv = Math.max(0, Math.min(1, val));
    setVol(nv);
    v.volume = nv;
    v.muted = nv === 0;
    setMuted(nv === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
  }, [muted]);

  const doSetSpeed = useCallback((s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setSpeedMenu(false);
  }, []);

  const toggleFull = useCallback(async () => {
    try {
      if (!document.fullscreenElement) await containerRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); setPip(false); }
      else { await v.requestPictureInPicture(); setPip(true); }
    } catch {}
  }, []);

  const seekTo = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar || !dur) return;
    const r = bar.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
  }, [dur]);

  // ── Hide controls ──
  const showCtrl = useCallback(() => {
    setControls(true);
    clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = window.setTimeout(() => setControls(false), 3000);
  }, [playing]);

  // ── Keyboard ──
  useEffect(() => {
    if (!video) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case " ": case "k": e.preventDefault(); togglePlay(); break;
        case "arrowleft": case "j": e.preventDefault(); skip(-10); break;
        case "arrowright": case "l": e.preventDefault(); skip(10); break;
        case "arrowup": e.preventDefault(); doSetVol(vol + 0.1); break;
        case "arrowdown": e.preventDefault(); doSetVol(vol - 0.1); break;
        case "m": e.preventDefault(); toggleMute(); break;
        case "f": e.preventDefault(); toggleFull(); break;
        case "escape": e.preventDefault(); if (full) toggleFull(); else onClose(); break;
        case "p": e.preventDefault(); togglePip(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [video, full, vol, togglePlay, skip, doSetVol, toggleMute, toggleFull, togglePip, onClose]);

  // ── Fullscreen listener ──
  useEffect(() => {
    const fn = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  if (!video) return null;

  const pct = dur > 0 ? (time / dur) * 100 : 0;
  const bufPct = dur > 0 ? (buf / dur) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 60 }} dir="ltr">
      {/* ── Header ── */}
      <div 
        className={`absolute top-0 left-0 right-0 p-4 transition-opacity duration-300 ${controls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ zIndex: 70, background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)" }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <X className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-white font-bold text-base md:text-xl truncate flex-1 mx-4 text-center">{video.title}</h2>
          <div className="w-10" />
        </div>
      </div>

      {/* ── Video ── */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center relative" onMouseMove={showCtrl} onMouseLeave={() => playing && setControls(false)}>
        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black" style={{ zIndex: 65 }}>
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                <circle cx="48" cy="48" r="42" fill="none" stroke={settings.primaryColor} strokeWidth="6"
                  strokeLinecap="round" strokeDasharray={`${264 * loadPct / 100} 264`} className="transition-all duration-300" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-white font-bold">{loadPct}%</span>
            </div>
            <p className="text-white/60 mt-4 text-sm">جاري تحميل الفيديو...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black" style={{ zIndex: 65 }}>
            <AlertCircle className="w-16 h-16 text-red-500" />
            <p className="text-red-400 text-lg mt-4">{error}</p>
          </div>
        )}

        {/* Video */}
        <video
          ref={videoRef}
          className="max-w-full max-h-full cursor-pointer"
          onClick={togglePlay}
          onLoadedMetadata={onLoaded}
          onTimeUpdate={onTimeUpd}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => { setError("فشل في تشغيل الفيديو"); setLoading(false); }}
          playsInline
          preload="auto"
        />

        {/* Big Play Button */}
        {!loading && !error && !playing && (
          <div className="absolute inset-0 flex items-center justify-center" onClick={togglePlay}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 transition-transform"
              style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})` }}>
              <Play className="w-10 h-10 text-white ml-1" fill="white" />
            </div>
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      {!loading && !error && (
        <div 
          className={`absolute bottom-0 left-0 right-0 pt-20 pb-5 px-4 transition-opacity duration-300 ${controls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          style={{ zIndex: 70, background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)" }}
        >
          <div className="max-w-7xl mx-auto space-y-3">
            {/* Progress */}
            <div ref={progressRef} className="relative h-2 bg-white/20 rounded-full cursor-pointer group hover:h-3 transition-all" onClick={seekTo}>
              <div className="absolute h-full bg-white/20 rounded-full" style={{ width: `${bufPct}%` }} />
              <div className="absolute h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${settings.primaryColor}, ${settings.accentColor})` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg border-2 border-white"
                style={{ left: `calc(${pct}% - 10px)`, background: settings.primaryColor, boxShadow: `0 0 12px ${settings.primaryColor}` }} />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 md:gap-2.5">
                {/* Play */}
                <button onClick={togglePlay} className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                  {playing ? <Pause className="w-5 h-5 text-white" fill="white" /> : <Play className="w-5 h-5 text-white ml-0.5" fill="white" />}
                </button>

                <button onClick={() => skip(-10)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 hidden sm:flex items-center justify-center">
                  <SkipBack className="w-4 h-4 text-white" />
                </button>

                <button onClick={() => skip(10)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 hidden sm:flex items-center justify-center">
                  <SkipForward className="w-4 h-4 text-white" />
                </button>

                {/* Volume */}
                <div className="flex items-center gap-1.5 group">
                  <button onClick={toggleMute} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                    {muted || vol === 0 ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                  </button>
                  <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : vol}
                    onChange={(e) => doSetVol(parseFloat(e.target.value))}
                    className="w-0 group-hover:w-20 transition-all duration-300 cursor-pointer"
                    style={{ accentColor: settings.primaryColor }}
                  />
                </div>

                {/* Time */}
                <span className="text-white/70 text-xs sm:text-sm font-mono whitespace-nowrap">
                  {formatDuration(time)} / {formatDuration(dur)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Speed Menu */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSpeedMenu(!speedMenu); }}
                    className="h-9 px-3 rounded-full flex items-center justify-center gap-1 text-xs font-bold transition-colors"
                    style={{ background: speedMenu || speed !== 1 ? settings.primaryColor : "rgba(255,255,255,0.1)", color: "white" }}
                  >
                    <Gauge className="w-3.5 h-3.5" />
                    {speed}x
                    <ChevronDown className={`w-3 h-3 transition-transform ${speedMenu ? "rotate-180" : ""}`} />
                  </button>
                  
                  {speedMenu && (
                    <div 
                      className="absolute bottom-12 right-0 rounded-xl border border-white/10 p-1.5 min-w-[150px] shadow-2xl"
                      style={{ background: "rgba(15,15,25,0.98)", zIndex: 80 }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="text-white/40 text-[10px] px-3 py-1.5 uppercase tracking-wider">سرعة التشغيل</div>
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); doSetSpeed(s); }}
                          className="w-full px-3 py-2 text-sm rounded-lg flex items-center justify-between transition-all"
                          style={{ background: speed === s ? settings.primaryColor : "transparent", color: "white" }}
                        >
                          <span>{s === 1 ? "عادي" : `${s}x`}</span>
                          {speed === s && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={togglePip} className="w-9 h-9 rounded-full flex items-center justify-center hidden sm:flex"
                  style={{ background: pip ? settings.primaryColor : "rgba(255,255,255,0.1)" }}>
                  <PictureInPicture2 className="w-4 h-4 text-white" />
                </button>

                <button onClick={toggleFull} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                  {full ? <Minimize className="w-4 h-4 text-white" /> : <Maximize className="w-4 h-4 text-white" />}
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="flex flex-wrap gap-2 text-[11px] text-white/40 pt-1">
              <span>{formatViews(video.views + 1)}</span>
              <span>•</span>
              <span>{formatDate(video.createdAt)}</span>
              <span>•</span>
              <span>{formatBytes(video.fileSize)}</span>
              <span>•</span>
              <span>{video.category}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
