import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Lock, Eye, EyeOff, Play, Loader2, Film, Upload, Trash2,
  EyeOff as Hidden, Shield, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Maximize, Minimize, ChevronDown, Gauge, Check,
} from "lucide-react";
import {
  VAULT_PASSWORD, ADMIN_PASSWORD, getAllSecretVideos, deleteSecretVideo,
  getSecretVideoUrl, incrementSecretViews, saveSecretVideo, validateFile,
  formatBytes, formatDuration, formatDate, formatViews,
} from "../lib/db";
import type { VideoMeta, SiteSettings } from "../lib/db";
import { useDropzone } from "react-dropzone";

interface Props {
  isOpen: boolean;
  settings: SiteSettings;
  onClose: () => void;
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function SecretVault({ isOpen, onClose }: Props) {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const isAdmin = sessionStorage.getItem("ofc_admin") === "true";

  const [videos, setVideos] = useState<VideoMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<VideoMeta | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Upload
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadText, setUploadText] = useState("");
  const [uploadIdx, setUploadIdx] = useState(0);

  // Player
  const vidRef = useRef<HTMLVideoElement>(null);
  const [vidSrc, setVidSrc] = useState<string | null>(null);
  const [vidLoading, setVidLoading] = useState(false);
  const [vidLoadPct, setVidLoadPct] = useState(0);
  const [isPlay, setIsPlay] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [speedMenu, setSpeedMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLDivElement>(null);

  const login = () => {
    if (pw === VAULT_PASSWORD || pw === ADMIN_PASSWORD) {
      setAuthed(true); setErr(""); setPw("");
    } else {
      setErr("كلمة المرور غير صحيحة");
    }
  };

  const loadVids = useCallback(async () => {
    setLoading(true);
    try { setVideos(await getAllSecretVideos()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (isOpen && authed) loadVids(); }, [isOpen, authed, loadVids]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await deleteSecretVideo(id); setVideos((v) => v.filter((x) => x.id !== id)); } catch {}
    setDeletingId(null);
  };

  // Upload
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (f) => setUploadFiles((p) => [...p, ...f.filter((x) => validateFile(x).valid)]),
    accept: { "video/*": [".mp4", ".webm", ".ogg", ".mov"] },
    multiple: true,
    disabled: uploading,
  });

  const startUpload = async () => {
    if (!uploadFiles.length) return;
    setUploading(true);
    for (let i = 0; i < uploadFiles.length; i++) {
      setUploadIdx(i);
      const f = uploadFiles[i];
      try {
        await saveSecretVideo(f, { title: f.name.replace(/\.[^/.]+$/, ""), description: "", category: "سري" }, (p, t) => { setUploadPct(p); setUploadText(t); });
      } catch {}
    }
    setUploading(false);
    setUploadFiles([]);
    setUploadPct(0);
    loadVids();
  };

  // Player
  const openPlayer = async (v: VideoMeta) => {
    setPlaying(v); setVidLoading(true); setVidSrc(null); setVidLoadPct(0);
    try {
      const url = await getSecretVideoUrl(v.id, v.fileType, setVidLoadPct);
      setVidSrc(url);
      incrementSecretViews(v.id);
    } catch { setVidSrc(null); }
    setVidLoading(false);
  };

  const closePlayer = () => { setPlaying(null); setVidSrc(null); setIsPlay(false); setCurTime(0); setDur(0); setSpeed(1); };

  const togglePlay = () => { const v = vidRef.current; if (!v) return; v.paused ? v.play() : v.pause(); };
  const skip = (s: number) => { const v = vidRef.current; if (v) v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + s)); };
  const setSpd = (s: number) => { const v = vidRef.current; if (v) v.playbackRate = s; setSpeed(s); setSpeedMenu(false); };

  if (!isOpen) return null;

  // ── LOGIN SCREEN ──
  if (!authed) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl" style={{ zIndex: 9999 }}>
        <div className="max-w-sm w-full text-center">
          <button onClick={onClose} className="absolute top-6 right-6 text-white/30 hover:text-white"><X className="w-6 h-6" /></button>
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-900/30 to-purple-900/30 flex items-center justify-center border-2 border-red-500/20 animate-pulse">
            <Hidden className="w-12 h-12 text-red-500/80" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">🔒 السيرفر الخفي</h2>
          <p className="text-white/40 text-sm mb-8">أدخل كلمة المرور للوصول</p>
          <div className="relative mb-4">
            <input type={showPw ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()} placeholder="كلمة المرور..."
              className="w-full px-4 py-4 rounded-xl bg-white/5 border border-red-500/20 text-white placeholder-white/20 focus:outline-none focus:border-red-500 text-center text-lg tracking-widest" dir="ltr" />
            <button onClick={() => setShowPw(!showPw)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {err && <p className="text-red-400 text-sm mb-4">{err}</p>}
          <button onClick={login} className="w-full py-4 rounded-xl bg-gradient-to-r from-red-800 to-red-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-900/30">
            <Lock className="w-5 h-5" /> فتح القبو
          </button>
        </div>
      </div>
    );
  }

  // ── PLAYER OVERLAY ──
  if (playing) {
    const pct = dur > 0 ? (curTime / dur) * 100 : 0;
    return (
      <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 9999 }}>
        <div className="flex items-center justify-between p-4 shrink-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)" }}>
          <button onClick={closePlayer} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><X className="w-5 h-5 text-white" /></button>
          <h2 className="text-white font-bold text-base truncate flex-1 mx-4 text-center">{playing.title}</h2>
          <span className="text-red-500 text-xs font-bold px-2 py-1 rounded bg-red-500/10">🔒 سري</span>
        </div>

        <div ref={containerRef} className="flex-1 flex items-center justify-center relative" onClick={togglePlay}>
          {vidLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                  <circle cx="48" cy="48" r="42" fill="none" stroke="#dc2626" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${264 * vidLoadPct / 100} 264`} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-white font-bold">{vidLoadPct}%</span>
              </div>
            </div>
          )}
          {vidSrc && <video ref={vidRef} src={vidSrc} className="max-w-full max-h-full" playsInline
            onLoadedMetadata={() => { if (vidRef.current) { setDur(vidRef.current.duration); vidRef.current.play(); } }}
            onTimeUpdate={() => { if (vidRef.current) setCurTime(vidRef.current.currentTime); }}
            onPlay={() => setIsPlay(true)} onPause={() => setIsPlay(false)} onEnded={() => setIsPlay(false)}
            onClick={(e) => e.stopPropagation()} />}
          {!vidLoading && !isPlay && vidSrc && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-red-600/90 flex items-center justify-center"><Play className="w-10 h-10 text-white ml-1" fill="white" /></div>
            </div>
          )}
        </div>

        {vidSrc && (
          <div className="p-4 shrink-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)" }}>
            <div ref={progRef} className="h-2 bg-white/20 rounded-full cursor-pointer mb-3 group" onClick={(e) => {
              if (!vidRef.current || !progRef.current) return;
              const r = progRef.current.getBoundingClientRect();
              vidRef.current.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
            }}>
              <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between" dir="ltr">
              <div className="flex items-center gap-2">
                <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                  {isPlay ? <Pause className="w-5 h-5 text-white" fill="white" /> : <Play className="w-5 h-5 text-white ml-0.5" fill="white" />}
                </button>
                <button onClick={() => skip(-10)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><SkipBack className="w-4 h-4 text-white" /></button>
                <button onClick={() => skip(10)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><SkipForward className="w-4 h-4 text-white" /></button>
                <div className="flex items-center gap-1.5 group">
                  <button onClick={() => { const v = vidRef.current; if (v) { v.muted = !muted; setMuted(!muted); } }} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                    {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                  </button>
                  <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : vol}
                    onChange={(e) => { const v = parseFloat(e.target.value); setVol(v); setMuted(v === 0); if (vidRef.current) { vidRef.current.volume = v; vidRef.current.muted = v === 0; } }}
                    className="w-0 group-hover:w-20 transition-all duration-300 accent-red-500 cursor-pointer" />
                </div>
                <span className="text-white/60 text-xs font-mono">{formatDuration(curTime)} / {formatDuration(dur)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setSpeedMenu(!speedMenu); }}
                    className="h-8 px-3 rounded-full flex items-center gap-1 text-xs font-bold"
                    style={{ background: speedMenu || speed !== 1 ? "#dc2626" : "rgba(255,255,255,0.1)", color: "white" }}>
                    <Gauge className="w-3 h-3" />{speed}x<ChevronDown className={`w-3 h-3 transition-transform ${speedMenu ? "rotate-180" : ""}`} />
                  </button>
                  {speedMenu && (
                    <div className="absolute bottom-10 right-0 bg-black/95 rounded-xl border border-white/10 p-1.5 min-w-[130px]" style={{ zIndex: 80 }}
                      onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                      {SPEEDS.map((s) => (
                        <button key={s} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSpd(s); }}
                          className="w-full px-3 py-1.5 text-sm rounded-lg flex items-center justify-between"
                          style={{ background: speed === s ? "#dc2626" : "transparent", color: "white" }}>
                          <span>{s === 1 ? "عادي" : `${s}x`}</span>{speed === s && <Check className="w-3 h-3" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={async () => { try { if (!document.fullscreenElement) await containerRef.current?.requestFullscreen(); else await document.exitFullscreen(); setFull(!full); } catch {} }}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                  {full ? <Minimize className="w-4 h-4 text-white" /> : <Maximize className="w-4 h-4 text-white" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── MAIN VAULT SCREEN ──
  return (
    <div className="fixed inset-0 bg-black/98 overflow-y-auto" style={{ zIndex: 9999 }}>
      {/* Header */}
      <div className="sticky top-0 z-10 p-4 border-b border-red-900/30" style={{ background: "rgba(10,5,5,0.95)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-800 to-red-600 flex items-center justify-center shadow-lg shadow-red-900/30">
              <Hidden className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-red-500">السيرفر الخفي</h1>
              <p className="text-xs text-white/30">{videos.length} فيديو سري</p>
            </div>
          </div>
          <button onClick={() => { setAuthed(false); onClose(); }} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6" dir="rtl">
        {/* Admin Upload */}
        {isAdmin && (
          <div className="rounded-2xl border border-red-900/30 bg-red-950/20 p-5 space-y-4">
            <div className="flex items-center gap-2 text-red-400 font-bold"><Shield className="w-5 h-5" /> رفع فيديوهات سرية (أدمن فقط)</div>
            <div {...getRootProps()} className="border-2 border-dashed border-red-900/30 rounded-xl p-6 text-center cursor-pointer hover:border-red-500/30 transition-all">
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 mx-auto mb-2 text-red-500/40" />
              <p className="text-white/50 text-sm">اسحب وأفلت فيديوهات أو اضغط لاختيار</p>
            </div>
            {uploadFiles.length > 0 && (
              <>
                <div className="space-y-1">
                  {uploadFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-white/60 bg-white/5 px-3 py-2 rounded-lg">
                      <Film className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-white/30">{formatBytes(f.size)}</span>
                      {!uploading && <button onClick={() => setUploadFiles((p) => p.filter((_, j) => j !== i))} className="text-red-400"><X className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-white/60">{uploadText}</span><span className="text-red-400 font-bold">{uploadPct}%</span></div>
                    <div className="h-2 bg-white/10 rounded-full"><div className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-500 transition-all" style={{ width: `${uploadPct}%` }} /></div>
                    <p className="text-white/30 text-xs">فيديو {uploadIdx + 1} من {uploadFiles.length}</p>
                  </div>
                )}
                {!uploading && (
                  <button onClick={startUpload} className="w-full py-3 rounded-xl bg-gradient-to-r from-red-800 to-red-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg">
                    <Upload className="w-5 h-5" /> رفع {uploadFiles.length} فيديو سري
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Videos Grid */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-red-500 animate-spin" /></div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <Hidden className="w-16 h-16 text-red-900/40 mx-auto mb-4" />
            <p className="text-white/30 text-lg">لا توجد فيديوهات سرية</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((v) => (
              <div key={v.id} className="group rounded-xl overflow-hidden border border-red-900/20 bg-red-950/10 hover:border-red-500/30 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-red-900/10">
                <div className="relative aspect-video cursor-pointer" onClick={() => openPlayer(v)}>
                  {v.thumbnail ? <img src={v.thumbnail} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" /> :
                    <div className="w-full h-full bg-gradient-to-br from-red-950 to-black flex items-center justify-center"><Film className="w-10 h-10 text-red-900/40" /></div>}
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-red-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all">
                      <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-red-600/80 text-white text-[10px] font-bold">🔒 سري</div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs">{formatDuration(v.duration)}</div>
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate cursor-pointer hover:text-red-400" onClick={() => openPlayer(v)}>{v.title}</p>
                      <p className="text-white/30 text-xs mt-1">{formatViews(v.views)} • {formatDate(v.createdAt)} • {formatBytes(v.fileSize)}</p>
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleDelete(v.id)} disabled={deletingId === v.id}
                        className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center shrink-0 disabled:opacity-50">
                        {deletingId === v.id ? <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-red-400" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
