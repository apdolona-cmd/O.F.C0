import { useState, useEffect } from "react";
import {
  X, Shield, Save, Palette, Tag, Type, Smile, Plus,
  Check, RotateCcw, Lock, Eye, EyeOff, Loader2,
  Upload, Trash2, Film,
} from "lucide-react";
import { getSettings, saveSettingsToCloud, DEFAULT_SETTINGS, ADMIN_PASSWORD, getAllVideos, deleteVideo, formatBytes, formatDate } from "../lib/db";
import type { SiteSettings, VideoMeta } from "../lib/db";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (s: SiteSettings) => void;
  onUpload: () => void;
  onRefresh: () => void;
}

export default function AdminPanel({ isOpen, onClose, onSettingsChange, onUpload, onRefresh }: Props) {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"settings" | "videos">("videos");
  
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [newCat, setNewCat] = useState("");

  // Video management
  const [videos, setVideos] = useState<VideoMeta[]>([]);
  const [loadingVids, setLoadingVids] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(getSettings());
      if (sessionStorage.getItem("ofc_admin") === "true") setAuthed(true);
    }
  }, [isOpen]);

  // Load videos when admin is authenticated
  useEffect(() => {
    if (authed && isOpen) loadVideos();
  }, [authed, isOpen]);

  const loadVideos = async () => {
    setLoadingVids(true);
    try {
      const v = await getAllVideos();
      setVideos(v);
    } catch {}
    setLoadingVids(false);
  };

  const login = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthed(true);
      sessionStorage.setItem("ofc_admin", "true");
      setError("");
      setPassword("");
    } else {
      setError("كلمة المرور غير صحيحة");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const u = await saveSettingsToCloud(settings);
      onSettingsChange(u);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const u = await saveSettingsToCloud(DEFAULT_SETTINGS);
      setSettings(u);
      onSettingsChange(u);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  };

  const handleDeleteVideo = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteVideo(id);
      setVideos((v) => v.filter((x) => x.id !== id));
      onRefresh();
    } catch {}
    setDeletingId(null);
  };

  const addCat = () => {
    const t = newCat.trim();
    if (t && !settings.categories.includes(t)) {
      setSettings({ ...settings, categories: [...settings.categories, t] });
      setNewCat("");
    }
  };

  const logout = () => {
    setAuthed(false);
    sessionStorage.removeItem("ofc_admin");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" style={{ zIndex: 9998 }}>
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden border border-red-500/20 shadow-2xl shadow-red-500/10 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-gradient-to-r from-red-900/20 to-purple-900/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-purple-600 flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">لوحة تحكم الأدمن</h2>
              <p className="text-xs text-white/40">إدارة كاملة للموقع</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {!authed ? (
          /* ── Login ── */
          <div className="p-8 flex-1">
            <div className="max-w-sm mx-auto text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-500/20 to-purple-500/20 flex items-center justify-center border-2 border-red-500/30">
                <Lock className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">الدخول للوحة التحكم</h3>
              <p className="text-white/40 text-sm mb-6">أدخل كلمة مرور الأدمن</p>
              <div className="relative mb-4">
                <input type={showPw ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && login()}
                  placeholder="كلمة المرور..."
                  className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-red-500 text-center text-lg tracking-widest" dir="ltr" />
                <button onClick={() => setShowPw(!showPw)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <button onClick={login} className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-purple-600 text-white font-bold flex items-center justify-center gap-2">
                <Shield className="w-5 h-5" /> دخول
              </button>
            </div>
          </div>
        ) : (
          /* ── Admin Panel ── */
          <>
            {/* Tabs */}
            <div className="flex border-b border-white/10 shrink-0">
              <button onClick={() => setTab("videos")}
                className={`flex-1 py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-all ${tab === "videos" ? "text-white border-b-2 border-red-500 bg-white/5" : "text-white/40 hover:text-white/70"}`}>
                <Film className="w-4 h-4" /> إدارة الفيديوهات
              </button>
              <button onClick={() => setTab("settings")}
                className={`flex-1 py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-all ${tab === "settings" ? "text-white border-b-2 border-purple-500 bg-white/5" : "text-white/40 hover:text-white/70"}`}>
                <Palette className="w-4 h-4" /> إعدادات الموقع
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {tab === "videos" ? (
                /* ── Videos Management ── */
                <>
                  {/* Upload Button */}
                  <button onClick={() => { onClose(); setTimeout(onUpload, 200); }}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-purple-600 text-white font-bold flex items-center justify-center gap-3 text-lg shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all">
                    <Upload className="w-6 h-6" /> رفع فيديو جديد
                  </button>

                  {/* Videos List */}
                  <div className="space-y-2">
                    <h3 className="text-white/50 text-sm font-medium">
                      الفيديوهات المرفوعة ({videos.length})
                    </h3>

                    {loadingVids ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
                      </div>
                    ) : videos.length === 0 ? (
                      <div className="text-center py-10">
                        <Film className="w-12 h-12 text-white/20 mx-auto mb-3" />
                        <p className="text-white/40">لا توجد فيديوهات</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                        {videos.map((v) => (
                          <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                            {/* Thumbnail */}
                            <div className="w-20 h-14 rounded-lg overflow-hidden bg-black shrink-0">
                              {v.thumbnail ? (
                                <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-white/5">
                                  <Film className="w-5 h-5 text-white/20" />
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium text-sm truncate">{v.title}</p>
                              <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                                <span>{formatBytes(v.fileSize)}</span>
                                <span>•</span>
                                <span>{v.views} مشاهدة</span>
                                <span>•</span>
                                <span>{formatDate(v.createdAt)}</span>
                              </div>
                            </div>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteVideo(v.id)}
                              disabled={deletingId === v.id}
                              className="w-10 h-10 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-all shrink-0 disabled:opacity-50"
                              title="حذف الفيديو"
                            >
                              {deletingId === v.id ? (
                                <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-red-400" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ── Settings ── */
                <>
                  <Section icon={<Type className="w-5 h-5 text-red-400" />} title="اسم الموقع">
                    <input type="text" value={settings.siteName}
                      onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:border-red-500 text-lg font-bold" />
                  </Section>

                  <Section icon={<Type className="w-5 h-5 text-purple-400" />} title="شعار الموقع">
                    <input type="text" value={settings.siteSlogan}
                      onChange={(e) => setSettings({ ...settings, siteSlogan: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white focus:outline-none focus:border-purple-500" />
                  </Section>

                  <Section icon={<Smile className="w-5 h-5 text-orange-400" />} title="أيقونة الشعار">
                    <div className="flex gap-2 flex-wrap">
                      <input type="text" value={settings.logoEmoji}
                        onChange={(e) => setSettings({ ...settings, logoEmoji: e.target.value })}
                        className="w-16 h-14 px-2 rounded-xl bg-black/30 border border-white/10 text-white text-center text-3xl focus:outline-none" maxLength={2} />
                      {["🔥", "💀", "👁️", "⚡", "🎬", "🖤", "💎", "🌙", "👑", "🦇"].map((e) => (
                        <button key={e} onClick={() => setSettings({ ...settings, logoEmoji: e })}
                          className={`w-14 h-14 rounded-xl text-2xl transition-all ${settings.logoEmoji === e ? "bg-red-600 scale-110 ring-2 ring-red-400" : "bg-white/5 hover:bg-white/10"}`}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </Section>

                  <Section icon={<Palette className="w-5 h-5 text-pink-400" />} title="الألوان">
                    <div className="grid grid-cols-2 gap-4">
                      <ColorPicker label="اللون الرئيسي" value={settings.primaryColor} onChange={(c) => setSettings({ ...settings, primaryColor: c })} />
                      <ColorPicker label="اللون الثانوي" value={settings.accentColor} onChange={(c) => setSettings({ ...settings, accentColor: c })} />
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {[
                        { p: "#dc2626", a: "#7c3aed", n: "أحمر + بنفسجي" },
                        { p: "#2563eb", a: "#06b6d4", n: "أزرق + سماوي" },
                        { p: "#16a34a", a: "#84cc16", n: "أخضر + ليموني" },
                        { p: "#ea580c", a: "#eab308", n: "برتقالي + ذهبي" },
                        { p: "#e11d48", a: "#f43f5e", n: "وردي" },
                        { p: "#8b5cf6", a: "#ec4899", n: "بنفسجي + وردي" },
                      ].map((t) => (
                        <button key={t.n} onClick={() => setSettings({ ...settings, primaryColor: t.p, accentColor: t.a })}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs">
                          <span className="w-4 h-4 rounded-full" style={{ background: `linear-gradient(135deg, ${t.p}, ${t.a})` }} />
                          {t.n}
                        </button>
                      ))}
                    </div>
                  </Section>

                  <Section icon={<Tag className="w-5 h-5 text-green-400" />} title="التصنيفات">
                    <div className="flex gap-2 mb-3">
                      <input type="text" value={newCat} onChange={(e) => setNewCat(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCat()} placeholder="تصنيف جديد..."
                        className="flex-1 px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-green-500" />
                      <button onClick={addCat} className="px-5 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold flex items-center gap-2">
                        <Plus className="w-5 h-5" /> إضافة
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {settings.categories.map((cat) => (
                        <div key={cat} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/30 border border-white/10">
                          <span className="text-white text-sm">{cat}</span>
                          <button onClick={() => setSettings({ ...settings, categories: settings.categories.filter((c) => c !== cat) })} className="text-white/30 hover:text-red-400">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </Section>

                  {/* Preview */}
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                    <p className="text-white/50 text-sm mb-3">معاينة:</p>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                        style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})` }}>
                        {settings.logoEmoji}
                      </div>
                      <div>
                        <h3 className="text-2xl font-black" style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                          {settings.siteName}
                        </h3>
                        <p className="text-white/40 text-xs">{settings.siteSlogan}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handleReset} disabled={saving}
                      className="flex-1 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50">
                      <RotateCcw className="w-5 h-5" /> استعادة الافتراضي
                    </button>
                    <button onClick={handleSave} disabled={saving}
                      className="flex-1 py-4 rounded-xl bg-gradient-to-r from-red-600 to-purple-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-red-500/20">
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : saved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                      {saving ? "جاري الحفظ..." : saved ? "تم الحفظ! ✅" : "حفظ وتطبيق"}
                    </button>
                  </div>
                </>
              )}

              {/* Logout */}
              <button onClick={logout}
                className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium flex items-center justify-center gap-2 border border-red-500/20">
                <Lock className="w-4 h-4" /> تسجيل الخروج
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
      <div className="flex items-center gap-3 mb-4">{icon}<h3 className="text-white font-bold">{title}</h3></div>
      {children}
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <label className="block text-white/60 text-sm mb-2">{label}</label>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-0" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white font-mono text-sm" dir="ltr" />
      </div>
    </div>
  );
}
