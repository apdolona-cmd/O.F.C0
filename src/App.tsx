import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, Film, RefreshCw, Eye, EyeOff,
  HardDrive, Video as VideoIcon, FolderOpen,
  Database, Shield, Flame,
} from "lucide-react";
import UploadModal from "./components/UploadModal";
import VideoPlayer from "./components/VideoPlayer";
import VideoCard from "./components/VideoCard";
import DeleteModal from "./components/DeleteModal";
import AdminPanel from "./components/AdminPanel";
import SecretVault from "./components/SecretVault";
import ShortsPlayer from "./components/ShortsPlayer";
import {
  getAllVideos, deleteVideo, getStorageInfo, formatBytes,
  MAX_FILE_SIZE, MAX_TOTAL_STORAGE, getSettings, loadSettingsFromCloud, trackVisitor,
} from "./lib/db";
import type { VideoMeta, SiteSettings } from "./lib/db";

// SVG Logo Component matching the favicon
function LogoIcon({ size = 48, primary = "#dc2626", accent = "#7c3aed" }: { size?: number; primary?: string; accent?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="drop-shadow-2xl">
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
        <filter id="logoGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="100" height="100" rx="22" fill="#0a0a14" />
      <rect x="3" y="3" width="94" height="94" rx="20" fill="none" stroke="url(#logoGrad)" strokeWidth="2.5" opacity="0.6" />
      <circle cx="50" cy="50" r="32" fill="none" stroke="url(#logoGrad)" strokeWidth="2" opacity="0.25" />
      <polygon points="40,28 76,50 40,72" fill="url(#logoGrad)" filter="url(#logoGlow)" />
    </svg>
  );
}

export default function App() {
  const [videos, setVideos] = useState<VideoMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [settings, setSettings] = useState<SiteSettings>(getSettings());

  const [showUpload, setShowUpload] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showShorts, setShowShorts] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<VideoMeta | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<VideoMeta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [storageUsed, setStorageUsed] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [adminTick, setAdminTick] = useState(0);

  const isAdmin = adminTick >= 0 && sessionStorage.getItem("ofc_admin") === "true";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const vids = await getAllVideos();
      setVideos(vids);
      const info = await getStorageInfo();
      setStorageUsed(info.used);
      setVideoCount(info.count);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSettingsFromCloud().then((s) => setSettings(s)); trackVisitor(); }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      const s = v.title.toLowerCase().includes(searchQuery.toLowerCase()) || v.description.toLowerCase().includes(searchQuery.toLowerCase());
      const c = selectedCategory === "الكل" || v.category === selectedCategory;
      return s && c;
    });
  }, [videos, searchQuery, selectedCategory]);

  const handleDelete = async () => {
    if (!deletingVideo || !isAdmin) return;
    setIsDeleting(true);
    try { await deleteVideo(deletingVideo.id); setDeletingVideo(null); await fetchData(); } catch {}
    finally { setIsDeleting(false); }
  };

  const totalViews = videos.reduce((s, v) => s + v.views, 0);
  const storagePercent = Math.round((storageUsed / MAX_TOTAL_STORAGE) * 100);
  const categories = ["الكل", ...settings.categories];

  return (
    <div className="min-h-screen" style={{ background: "#06060e" }} dir="rtl">
      {/* ═══ ANIMATED BACKGROUND ═══ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-60 -right-60 w-[800px] h-[800px] rounded-full blur-[200px] opacity-20"
          style={{ background: `radial-gradient(circle, ${settings.primaryColor}, transparent)`, animation: "float 8s ease-in-out infinite" }} />
        <div className="absolute -bottom-60 -left-60 w-[800px] h-[800px] rounded-full blur-[200px] opacity-15"
          style={{ background: `radial-gradient(circle, ${settings.accentColor}, transparent)`, animation: "float 8s ease-in-out infinite 3s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[250px] opacity-10"
          style={{ background: `conic-gradient(from 0deg, ${settings.primaryColor}, ${settings.accentColor}, #3b82f6, ${settings.primaryColor})`, animation: "spin 20s linear infinite" }} />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: `radial-gradient(${settings.primaryColor} 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
        {/* Scan line */}
        <div className="absolute inset-x-0 h-px opacity-5" style={{ background: settings.primaryColor, animation: "scan 4s linear infinite" }} />
      </div>

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-40 border-b backdrop-blur-2xl"
        style={{ borderColor: `${settings.primaryColor}15`, background: "rgba(6,6,14,0.8)" }}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col lg:flex-row items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="relative">
                <LogoIcon size={52} primary={settings.primaryColor} accent={settings.accentColor} />
                {/* Glow ring */}
                <div className="absolute -inset-1 rounded-2xl opacity-30 blur-md -z-10"
                  style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})` }} />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight rainbow-text">
                  {settings.siteName}
                </h1>
                <p className="text-[11px] text-white/35 tracking-wider">{settings.siteSlogan}</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 w-full max-w-2xl">
              <div className="relative group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-white/50 transition-colors" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في الفيديوهات..."
                  className="w-full h-12 pl-4 pr-12 rounded-2xl bg-white/[0.04] border text-white placeholder-white/25 focus:outline-none focus:bg-white/[0.07] transition-all"
                  style={{ borderColor: searchQuery ? `${settings.primaryColor}40` : "rgba(255,255,255,0.06)" }} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              <button onClick={fetchData} disabled={loading} title="تحديث"
                className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-all disabled:opacity-50">
                <RefreshCw className={`w-4.5 h-4.5 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button onClick={() => setShowAdmin(true)} title={isAdmin ? "لوحة الأدمن ✓" : "تسجيل دخول"}
                className="w-11 h-11 rounded-xl border flex items-center justify-center transition-all"
                style={{
                  background: isAdmin ? `${settings.primaryColor}15` : "rgba(255,255,255,0.04)",
                  borderColor: isAdmin ? `${settings.primaryColor}30` : "rgba(255,255,255,0.06)",
                  color: isAdmin ? settings.primaryColor : "rgba(255,255,255,0.4)"
                }}>
                <Shield className="w-4.5 h-4.5" />
              </button>

              <button onClick={() => setShowShorts(true)} title="شورتات 🔥"
                className="w-11 h-11 rounded-xl border border-pink-500/15 bg-pink-500/[0.06] text-pink-500/70 hover:bg-pink-500/10 hover:text-pink-400 flex items-center justify-center transition-all">
                <Flame className="w-4.5 h-4.5" />
              </button>

              <button onClick={() => setShowVault(true)} title="السيرفر الخفي 🔒"
                className="w-11 h-11 rounded-xl border border-red-500/15 bg-red-500/[0.06] text-red-500/70 hover:bg-red-500/10 hover:text-red-400 flex items-center justify-center transition-all">
                <EyeOff className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* ═══ STATS ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { icon: VideoIcon, label: "فيديو", value: videoCount, color: settings.primaryColor },
            { icon: Eye, label: "مشاهدة", value: totalViews, color: "#3b82f6" },
            { icon: Database, label: `مساحة (${storagePercent}%)`, value: formatBytes(storageUsed), color: "#10b981" },
            { icon: HardDrive, label: "حد الفيديو", value: formatBytes(MAX_FILE_SIZE), color: settings.accentColor },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl p-4 border backdrop-blur-sm transition-all hover:scale-[1.03] group"
              style={{ background: `${stat.color}08`, borderColor: `${stat.color}15` }}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: `${stat.color}15` }}>
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/40">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ CATEGORIES ═══ */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-8 scrollbar-hide">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className="px-5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
              style={{
                background: selectedCategory === cat ? `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})` : "rgba(255,255,255,0.04)",
                color: selectedCategory === cat ? "white" : "rgba(255,255,255,0.5)",
                boxShadow: selectedCategory === cat ? `0 4px 15px -3px ${settings.primaryColor}40` : "none",
                border: selectedCategory === cat ? "none" : "1px solid rgba(255,255,255,0.05)"
              }}>
              {cat}
            </button>
          ))}
        </div>

        {/* ═══ CONTENT ═══ */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 animate-spin"
                style={{ borderColor: `${settings.primaryColor}15`, borderTopColor: settings.primaryColor }} />
              <Flame className="absolute inset-0 m-auto w-7 h-7 animate-pulse" style={{ color: settings.primaryColor }} />
            </div>
            <p className="text-white/40 mt-5 text-sm">جاري التحميل...</p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-28 h-28 rounded-full flex items-center justify-center mb-6"
              style={{ background: `${settings.primaryColor}08`, border: `2px solid ${settings.primaryColor}15` }}>
              {videos.length === 0 ? <Film className="w-14 h-14" style={{ color: `${settings.primaryColor}60` }} /> :
                <FolderOpen className="w-14 h-14" style={{ color: `${settings.primaryColor}60` }} />}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {videos.length === 0 ? "لا توجد فيديوهات بعد" : "لا توجد نتائج"}
            </h3>
            <p className="text-white/40 mb-6 text-center max-w-md text-sm">
              {videos.length === 0
                ? (isAdmin ? "ابدأ برفع أول فيديو من لوحة التحكم!" : "لم يتم رفع فيديوهات بعد.")
                : "جرّب كلمات بحث مختلفة أو غيّر التصنيف"}
            </p>
            {videos.length === 0 && isAdmin && (
              <button onClick={() => setShowAdmin(true)}
                className="px-7 py-3 rounded-xl text-white font-bold flex items-center gap-2 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})` }}>
                <Shield className="w-5 h-5" /> افتح لوحة التحكم
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVideos.map((video) => (
              <VideoCard key={video.id} video={video} settings={settings} isAdmin={isAdmin}
                onPlay={setPlayingVideo} onDelete={isAdmin ? setDeletingVideo : () => {}} onUpdate={fetchData} />
            ))}
          </div>
        )}
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t py-8 mt-16" style={{ borderColor: `${settings.primaryColor}08` }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <LogoIcon size={28} primary={settings.primaryColor} accent={settings.accentColor} />
              <span className="text-white/30 text-sm">{settings.siteName} — {settings.siteSlogan}</span>
            </div>
            <div className="flex items-center gap-4 text-white/20 text-xs">
              <span>{formatBytes(MAX_FILE_SIZE)} لكل فيديو</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>إجمالي {formatBytes(MAX_TOTAL_STORAGE)}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ═══ MODALS ═══ */}
      <UploadModal isOpen={showUpload && isAdmin} settings={settings} onClose={() => setShowUpload(false)} onComplete={fetchData} />
      <VideoPlayer video={playingVideo} settings={settings} onClose={() => setPlayingVideo(null)} />
      <DeleteModal video={isAdmin ? deletingVideo : null} isDeleting={isDeleting} onConfirm={handleDelete} onCancel={() => setDeletingVideo(null)} />
      <AdminPanel isOpen={showAdmin} onClose={() => { setShowAdmin(false); setAdminTick((t) => t + 1); }}
        onSettingsChange={(s) => setSettings(s)} onUpload={() => setShowUpload(true)} onRefresh={fetchData} />
      <SecretVault isOpen={showVault} settings={settings} onClose={() => setShowVault(false)} />
      <ShortsPlayer isOpen={showShorts} settings={settings} onClose={() => setShowShorts(false)} />

      {/* ═══ GLOBAL STYLES ═══ */}
      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-30px); }
        }
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        @keyframes spin {
          from { transform: translate(-50%,-50%) rotate(0deg); }
          to { transform: translate(-50%,-50%) rotate(360deg); }
        }
        @keyframes rainbow {
          0% { color: #ff0000; text-shadow: 0 0 20px #ff000040; }
          14% { color: #ff7700; text-shadow: 0 0 20px #ff770040; }
          28% { color: #ffdd00; text-shadow: 0 0 20px #ffdd0040; }
          42% { color: #00ff00; text-shadow: 0 0 20px #00ff0040; }
          57% { color: #0099ff; text-shadow: 0 0 20px #0099ff40; }
          71% { color: #6600ff; text-shadow: 0 0 20px #6600ff40; }
          85% { color: #ff00ff; text-shadow: 0 0 20px #ff00ff40; }
          100% { color: #ff0000; text-shadow: 0 0 20px #ff000040; }
        }
        .rainbow-text {
          animation: rainbow 4s linear infinite;
        }
      `}</style>
    </div>
  );
}
