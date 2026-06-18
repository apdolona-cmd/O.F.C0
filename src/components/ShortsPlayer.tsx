import { useState, useEffect, useRef } from "react";
import {
  X, Play, Pause, Heart, ChevronUp, ChevronDown,
  Volume2, VolumeX, Upload, Trash2, Loader2, Film, Flame, Globe,
  Link2,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import {
  formatBytes, formatDate,
} from "../lib/db";
import type { SiteSettings } from "../lib/db";
import { getDatabase, ref, set, get, remove, push, child } from "firebase/database";

// Reuse the same rtdb from lib/db — we import firebase app
import { getApps } from "firebase/app";

const app = getApps()[0];
const rtdb = getDatabase(app);

interface Props {
  isOpen: boolean;
  settings: SiteSettings;
  onClose: () => void;
}

interface ShortVideo {
  id: string;
  title: string;
  blobUrl?: string;
  type: "local" | "tiktok";
  tiktokId?: string;
  createdAt: number;
  likes: number;
}

// ── Firebase Shorts CRUD ──
async function saveShortMeta(data: Omit<ShortVideo, "id" | "blobUrl">): Promise<string> {
  const id = push(child(ref(rtdb), "shorts")).key!;
  await set(ref(rtdb, `shorts/${id}`), data);
  return id;
}

async function saveShortChunks(id: string, file: File, onPct: (p: number) => void) {
  const CHUNK = 800 * 1024;
  const buf = await file.arrayBuffer();
  const data = new Uint8Array(buf);
  const total = Math.ceil(data.length / CHUNK);
  for (let i = 0; i < total; i++) {
    let b = ""; const slice = data.slice(i * CHUNK, Math.min((i + 1) * CHUNK, data.length));
    for (let j = 0; j < slice.length; j++) b += String.fromCharCode(slice[j]);
    await set(ref(rtdb, `short_chunks/${id}/${i}`), btoa(b));
    onPct(Math.round(((i + 1) / total) * 100));
  }
}

async function loadShortBlob(id: string): Promise<string | null> {
  const snap = await get(ref(rtdb, `short_chunks/${id}`));
  if (!snap.exists()) return null;
  const chunks = snap.val();
  const indices = Object.keys(chunks).map(Number).sort((a, b) => a - b);
  const arrays: Uint8Array[] = [];
  for (const idx of indices) {
    const bin = atob(chunks[idx]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    arrays.push(arr);
  }
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const combined = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { combined.set(a, off); off += a.length; }
  return URL.createObjectURL(new Blob([combined], { type: "video/mp4" }));
}

async function getAllShorts(): Promise<ShortVideo[]> {
  const snap = await get(ref(rtdb, "shorts"));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data).map(([id, v]: [string, any]) => ({
    id, title: v.title || "", type: v.type || "local", tiktokId: v.tiktokId || "",
    createdAt: v.createdAt || Date.now(), likes: v.likes || 0,
  })).sort((a, b) => b.createdAt - a.createdAt);
}

async function deleteShort(id: string) {
  await remove(ref(rtdb, `shorts/${id}`));
  await remove(ref(rtdb, `short_chunks/${id}`));
}

export default function ShortsPlayer({ isOpen, settings, onClose }: Props) {
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [vidSrc, setVidSrc] = useState<string | null>(null);
  const [vidLoading, setVidLoading] = useState(false);
  const [isPlay, setIsPlay] = useState(false);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const vidRef = useRef<HTMLVideoElement>(null);

  // Admin upload
  const isAdmin = sessionStorage.getItem("ofc_admin") === "true";
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [uploadTab, setUploadTab] = useState<"file" | "tiktok">("file");

  // Load shorts
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getAllShorts().then((s) => { setShorts(s); setCurrentIdx(0); }).finally(() => setLoading(false));
  }, [isOpen]);

  // Load current short video
  const current = shorts[currentIdx];
  useEffect(() => {
    if (!current) { setVidSrc(null); return; }
    if (current.type === "tiktok") { setVidSrc(null); return; }
    setVidLoading(true);
    loadShortBlob(current.id).then((url) => { setVidSrc(url); setVidLoading(false); });
  }, [current]);

  const goNext = () => { if (currentIdx < shorts.length - 1) setCurrentIdx(currentIdx + 1); };
  const goPrev = () => { if (currentIdx > 0) setCurrentIdx(currentIdx - 1); };

  const toggleLike = () => {
    if (!current) return;
    setLiked((prev) => {
      const n = new Set(prev);
      if (n.has(current.id)) n.delete(current.id); else n.add(current.id);
      return n;
    });
  };

  // Upload short
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (f) => f[0] && setUploadFile(f[0]),
    accept: { "video/*": [".mp4", ".webm"] },
    maxFiles: 1, disabled: uploading,
  });

  const extractTikTokId = (url: string): string | null => {
    const match = url.match(/video\/(\d+)/);
    return match ? match[1] : null;
  };

  const handleUpload = async () => {
    if (uploadTab === "tiktok") {
      const tikId = extractTikTokId(tiktokUrl);
      if (!tikId) return;
      await saveShortMeta({ title: `TikTok #${tikId}`, type: "tiktok", tiktokId: tikId, createdAt: Date.now(), likes: 0 });
      setTiktokUrl("");
    } else {
      if (!uploadFile) return;
      setUploading(true);
      const id = await saveShortMeta({ title: uploadFile.name.replace(/\.[^/.]+$/, ""), type: "local", createdAt: Date.now(), likes: 0 });
      await saveShortChunks(id, uploadFile, setUploadPct);
      setUploadFile(null);
      setUploadPct(0);
      setUploading(false);
    }
    setShowUpload(false);
    const s = await getAllShorts();
    setShorts(s);
  };

  const handleDeleteCurrent = async () => {
    if (!current) return;
    await deleteShort(current.id);
    const s = await getAllShorts();
    setShorts(s);
    if (currentIdx >= s.length) setCurrentIdx(Math.max(0, s.length - 1));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 9990 }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center backdrop-blur-sm">
          <X className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-white font-black text-lg flex items-center gap-2">
          <Flame className="w-5 h-5" style={{ color: settings.primaryColor }} />
          شورتات
        </h2>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <button onClick={() => setShowUpload(!showUpload)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </button>
              {current && (
                <button onClick={handleDeleteCurrent} className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Upload Panel */}
      {showUpload && isAdmin && (
        <div className="absolute top-16 right-4 left-4 z-30 bg-black/95 backdrop-blur-xl rounded-2xl border border-white/10 p-4 space-y-3 max-w-md mx-auto">
          <div className="flex gap-2">
            <button onClick={() => setUploadTab("file")} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${uploadTab === "file" ? "bg-white/10 text-white" : "text-white/40"}`}>
              <Film className="w-4 h-4" /> ملف فيديو
            </button>
            <button onClick={() => setUploadTab("tiktok")} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${uploadTab === "tiktok" ? "bg-white/10 text-white" : "text-white/40"}`}>
              <Globe className="w-4 h-4" /> رابط تيك توك
            </button>
          </div>

          {uploadTab === "file" ? (
            <>
              <div {...getRootProps()} className="border border-dashed border-white/20 rounded-xl p-4 text-center cursor-pointer hover:border-white/40">
                <input {...getInputProps()} />
                {uploadFile ? (
                  <p className="text-white text-sm truncate">{uploadFile.name} ({formatBytes(uploadFile.size)})</p>
                ) : (
                  <p className="text-white/40 text-sm">اختر فيديو قصير</p>
                )}
              </div>
              {uploading && (
                <div className="h-2 bg-white/10 rounded-full"><div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${uploadPct}%` }} /></div>
              )}
            </>
          ) : (
            <div className="flex gap-2">
              <input type="text" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@user/video/123..."
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none" dir="ltr" />
              <Link2 className="w-5 h-5 text-white/30 mt-2.5" />
            </div>
          )}

          <button onClick={handleUpload}
            disabled={uploading || (uploadTab === "file" ? !uploadFile : !extractTikTokId(tiktokUrl))}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? `جاري الرفع ${uploadPct}%` : uploadTab === "tiktok" ? "إضافة تيك توك" : "رفع شورت"}
          </button>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: settings.primaryColor }} />
        </div>
      ) : shorts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <Flame className="w-16 h-16 mb-4" style={{ color: `${settings.primaryColor}40` }} />
          <p className="text-white/50 text-lg">لا توجد شورتات بعد</p>
          {isAdmin && <p className="text-white/30 text-sm mt-2">اضغط + لرفع شورت جديد</p>}
        </div>
      ) : current ? (
        <div className="flex-1 flex items-center justify-center relative">
          {/* Video */}
          {current.type === "tiktok" ? (
            <div className="w-full max-w-[400px] h-full flex items-center justify-center">
              <iframe
                src={`https://www.tiktok.com/embed/v2/${current.tiktokId}`}
                className="w-full rounded-xl border-0"
                style={{ height: "calc(100vh - 120px)", maxHeight: "700px" }}
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          ) : vidLoading ? (
            <Loader2 className="w-12 h-12 animate-spin" style={{ color: settings.primaryColor }} />
          ) : vidSrc ? (
            <video ref={vidRef} src={vidSrc}
              className="h-full max-h-[calc(100vh-80px)] max-w-full object-contain rounded-xl"
              loop playsInline autoPlay muted={muted}
              onClick={() => { const v = vidRef.current; if (v) { v.paused ? v.play() : v.pause(); } }}
              onPlay={() => setIsPlay(true)} onPause={() => setIsPlay(false)}
            />
          ) : null}

          {/* Side Actions */}
          <div className="absolute right-3 bottom-1/4 flex flex-col gap-5 items-center z-20">
            <button onClick={toggleLike} className="flex flex-col items-center gap-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${liked.has(current.id) ? "bg-red-500 scale-110" : "bg-white/10"}`}>
                <Heart className={`w-6 h-6 ${liked.has(current.id) ? "text-white fill-white" : "text-white"}`} />
              </div>
              <span className="text-white text-xs">{current.likes + (liked.has(current.id) ? 1 : 0)}</span>
            </button>

            <button onClick={() => setMuted(!muted)} className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                {muted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
              </div>
            </button>

            {current.type !== "tiktok" && (
              <button onClick={() => { const v = vidRef.current; if (v) { v.paused ? v.play() : v.pause(); } }} className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  {isPlay ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-0.5" fill="white" />}
                </div>
              </button>
            )}
          </div>

          {/* Navigation */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
            <button onClick={goPrev} disabled={currentIdx === 0}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-20 transition-all">
              <ChevronUp className="w-5 h-5 text-white" />
            </button>
            <span className="text-white/50 text-xs text-center">{currentIdx + 1}/{shorts.length}</span>
            <button onClick={goNext} disabled={currentIdx >= shorts.length - 1}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-20 transition-all">
              <ChevronDown className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Title */}
          <div className="absolute bottom-6 left-16 right-16 z-20">
            <p className="text-white font-bold text-lg drop-shadow-lg">{current.title}</p>
            <p className="text-white/50 text-xs mt-1">{formatDate(current.createdAt)}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
