import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, Film, RefreshCw, Eye,
  HardDrive, Video as VideoIcon, FolderOpen,
  Database, Shield, Flame,
} from "lucide-react";
import UploadModal from "./components/UploadModal";
import VideoPlayer from "./components/VideoPlayer";
import VideoCard from "./components/VideoCard";
import DeleteModal from "./components/DeleteModal";
import AdminPanel from "./components/AdminPanel";
import {
  getAllVideos, deleteVideo, getStorageInfo, formatBytes,
  MAX_FILE_SIZE, MAX_TOTAL_STORAGE, getSettings, loadSettingsFromCloud, trackVisitor,
} from "./lib/db";
import type { VideoMeta, SiteSettings } from "./lib/db";

export default function App() {
  const [videos, setVideos] = useState<VideoMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [settings, setSettings] = useState<SiteSettings>(getSettings());
  
  const [showUpload, setShowUpload] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<VideoMeta | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<VideoMeta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [storageUsed, setStorageUsed] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [adminTick, setAdminTick] = useState(0);

  // Re-evaluate on every adminTick change
  const isAdmin = adminTick >= 0 && sessionStorage.getItem("ofc_admin") === "true";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const vids = await getAllVideos();
      setVideos(vids);
      const info = await getStorageInfo();
      setStorageUsed(info.used);
      setVideoCount(info.count);
    } catch (err) {
      console.error("Error loading videos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettingsFromCloud().then((s) => setSettings(s));
    trackVisitor();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      const matchesSearch =
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "الكل" || v.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [videos, searchQuery, selectedCategory]);

  const handleDelete = async () => {
    if (!deletingVideo || !isAdmin) return;
    setIsDeleting(true);
    try {
      await deleteVideo(deletingVideo.id);
      setDeletingVideo(null);
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Upload only from admin panel

  const totalViews = videos.reduce((s, v) => s + v.views, 0);
  const storagePercent = Math.round((storageUsed / MAX_TOTAL_STORAGE) * 100);
  const categories = ["الكل", ...settings.categories];

  return (
    <div className="min-h-screen" style={{ background: "#0a0a12" }} dir="rtl">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full blur-[180px] animate-pulse"
          style={{ background: `${settings.primaryColor}15` }} />
        <div className="absolute -bottom-40 -left-40 w-[700px] h-[700px] rounded-full blur-[180px] animate-pulse"
          style={{ background: `${settings.accentColor}15`, animationDelay: "1s" }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[200px]"
          style={{ background: `${settings.primaryColor}08` }} />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: `linear-gradient(${settings.primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${settings.primaryColor} 1px, transparent 1px)`, backgroundSize: "50px 50px" }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{ borderColor: `${settings.primaryColor}20`, background: "rgba(10,10,18,0.85)" }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl text-3xl relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})`, boxShadow: `0 10px 40px -10px ${settings.primaryColor}60` }}>
                <span className="relative z-10">{settings.logoEmoji}</span>
                <div className="absolute inset-0 bg-white/20 blur-xl" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight"
                  style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor}, ${settings.primaryColor})`, backgroundSize: "200% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "gradient 3s ease infinite" }}>
                  {settings.siteName}
                </h1>
                <p className="text-xs text-white/40">{settings.siteSlogan}</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 w-full max-w-2xl">
              <div className="relative group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-white/50 transition-colors" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في الفيديوهات..."
                  className="w-full h-12 pl-4 pr-12 rounded-2xl bg-white/5 border text-white placeholder-white/30 focus:outline-none transition-all"
                  style={{ borderColor: searchQuery ? `${settings.primaryColor}50` : "rgba(255,255,255,0.1)" }} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button onClick={fetchData} disabled={loading}
                className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all disabled:opacity-50">
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
              </button>
              
              <button onClick={() => setShowAdmin(true)}
                className="w-12 h-12 rounded-2xl border flex items-center justify-center transition-all"
                style={{
                  background: isAdmin ? `${settings.primaryColor}20` : "rgba(255,255,255,0.05)",
                  borderColor: isAdmin ? `${settings.primaryColor}40` : "rgba(255,255,255,0.1)",
                  color: isAdmin ? settings.primaryColor : "rgba(255,255,255,0.5)"
                }}
                title={isAdmin ? "لوحة الأدمن (مسجل دخول)" : "تسجيل دخول الأدمن"}>
                <Shield className="w-5 h-5" />
              </button>

              {/* No upload button for visitors - admin uploads from admin panel */}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: VideoIcon, label: "فيديو", value: videoCount, color: settings.primaryColor },
            { icon: Eye, label: "مشاهدة", value: totalViews, color: "#3b82f6" },
            { icon: Database, label: `مستخدم (${storagePercent}%)`, value: formatBytes(storageUsed), color: "#22c55e" },
            { icon: HardDrive, label: "حد كل فيديو", value: formatBytes(MAX_FILE_SIZE), color: settings.accentColor },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl p-5 border backdrop-blur-sm transition-all hover:scale-[1.02]"
              style={{ background: `linear-gradient(135deg, ${stat.color}10, ${stat.color}05)`, borderColor: `${stat.color}20` }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}20` }}>
                  <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-white/50">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all"
              style={{
                background: selectedCategory === cat ? `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})` : "rgba(255,255,255,0.05)",
                color: selectedCategory === cat ? "white" : "rgba(255,255,255,0.6)",
                boxShadow: selectedCategory === cat ? `0 5px 20px -5px ${settings.primaryColor}50` : "none",
                border: selectedCategory === cat ? "none" : "1px solid rgba(255,255,255,0.05)"
              }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 animate-spin"
                style={{ borderColor: `${settings.primaryColor}20`, borderTopColor: settings.primaryColor }} />
              <Flame className="absolute inset-0 m-auto w-8 h-8 animate-pulse" style={{ color: settings.primaryColor }} />
            </div>
            <p className="text-white/50 mt-4">جاري التحميل...</p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-28 h-28 rounded-full flex items-center justify-center mb-6" style={{ background: `${settings.primaryColor}10` }}>
              {videos.length === 0 ? <Film className="w-14 h-14" style={{ color: settings.primaryColor }} /> : <FolderOpen className="w-14 h-14" style={{ color: settings.primaryColor }} />}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {videos.length === 0 ? "لا توجد فيديوهات بعد" : "لا توجد نتائج"}
            </h3>
            <p className="text-white/50 mb-6 text-center max-w-md">
              {videos.length === 0
                ? (isAdmin ? "ابدأ برفع أول فيديو!" : "لم يتم رفع فيديوهات بعد. تواصل مع الأدمن.")
                : "جرّب البحث بكلمات مختلفة أو غيّر التصنيف"}
            </p>
            {videos.length === 0 && isAdmin && (
              <button onClick={() => setShowAdmin(true)}
                className="px-8 py-4 rounded-2xl text-white font-bold flex items-center gap-2 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})`, boxShadow: `0 15px 40px -10px ${settings.primaryColor}50` }}>
                <Shield className="w-5 h-5" /> افتح لوحة التحكم للرفع
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                settings={settings}
                isAdmin={isAdmin}
                onPlay={setPlayingVideo}
                onDelete={isAdmin ? setDeletingVideo : () => {}}
                onUpdate={fetchData}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t py-6 mt-16" style={{ borderColor: `${settings.primaryColor}10` }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})` }}>
                {settings.logoEmoji}
              </div>
              <span className="text-white/50 text-sm">{settings.siteName} - {settings.siteSlogan}</span>
            </div>
            <div className="flex items-center gap-6 text-white/30 text-xs">
              <span>الحد الأقصى: {formatBytes(MAX_FILE_SIZE)} لكل فيديو</span>
              <span>•</span>
              <span>إجمالي التخزين: {formatBytes(MAX_TOTAL_STORAGE)}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <UploadModal isOpen={showUpload && isAdmin} settings={settings} onClose={() => setShowUpload(false)} onComplete={fetchData} />
      <VideoPlayer video={playingVideo} settings={settings} onClose={() => setPlayingVideo(null)} />
      <DeleteModal video={isAdmin ? deletingVideo : null} isDeleting={isDeleting} onConfirm={handleDelete} onCancel={() => setDeletingVideo(null)} />
      <AdminPanel
        isOpen={showAdmin}
        onClose={() => { setShowAdmin(false); setAdminTick((t) => t + 1); }}
        onSettingsChange={(s) => setSettings(s)}
        onUpload={() => setShowUpload(true)}
        onRefresh={fetchData}
      />

      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}
