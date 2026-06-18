import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, X, Film, Loader2, CheckCircle, AlertCircle,
  Flame, Trash2, Plus,
} from "lucide-react";
import { saveVideo, validateFile, formatBytes, MAX_FILE_SIZE } from "../lib/db";
import type { SiteSettings } from "../lib/db";

interface Props {
  isOpen: boolean;
  settings: SiteSettings;
  onClose: () => void;
  onComplete: () => void;
}

interface QueueItem {
  id: string;
  file: File;
  title: string;
  description: string;
  category: string;
  progress: number;
  statusText: string;
  status: "pending" | "uploading" | "done" | "error";
  error: string;
}

let nextId = 0;

export default function UploadModal({ isOpen, settings, onClose, onComplete }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [globalCategory, setGlobalCategory] = useState(settings.categories[0] || "أخرى");

  const addFiles = useCallback((files: File[]) => {
    const newItems: QueueItem[] = [];
    for (const f of files) {
      const v = validateFile(f);
      if (!v.valid) continue;
      newItems.push({
        id: `q_${++nextId}`,
        file: f,
        title: f.name.replace(/\.[^/.]+$/, ""),
        description: "",
        category: globalCategory,
        progress: 0,
        statusText: "",
        status: "pending",
        error: "",
      });
    }
    setQueue((prev) => [...prev, ...newItems]);
  }, [globalCategory]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: addFiles,
    accept: { "video/*": [".mp4", ".webm", ".ogg", ".mov"] },
    multiple: true,
    disabled: uploading,
  });

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((x) => x.id !== id));
  };

  const updateItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((x) => (x.id === id ? { ...x, ...updates } : x)));
  };

  const startUpload = async () => {
    if (queue.length === 0) return;
    setUploading(true);

    for (const item of queue) {
      if (item.status === "done") continue;

      updateItem(item.id, { status: "uploading", progress: 0, error: "" });

      try {
        await saveVideo(
          item.file,
          { title: item.title, description: item.description, category: item.category },
          (p, text) => updateItem(item.id, { progress: p, statusText: text })
        );
        updateItem(item.id, { status: "done", progress: 100, statusText: "تم ✅" });
      } catch (err: any) {
        updateItem(item.id, { status: "error", error: err.message || "فشل الرفع" });
      }
    }

    setUploading(false);
    onComplete();
  };

  const handleClose = () => {
    if (uploading) return;
    setQueue([]);
    onClose();
  };

  const doneCount = queue.filter((x) => x.status === "done").length;
  const errorCount = queue.filter((x) => x.status === "error").length;
  const allDone = queue.length > 0 && doneCount === queue.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" style={{ zIndex: 9997 }}>
      <div className="rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden border shadow-2xl flex flex-col"
        style={{ background: "linear-gradient(135deg, rgba(26,26,46,0.98), rgba(15,15,26,0.99))", borderColor: `${settings.primaryColor}30` }}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0"
          style={{ borderColor: `${settings.primaryColor}20`, background: `linear-gradient(135deg, ${settings.primaryColor}10, ${settings.accentColor}10)` }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})` }}>
              <Upload className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">رفع فيديوهات</h2>
              <p className="text-xs text-white/40">
                {queue.length === 0 ? `الحد: ${formatBytes(MAX_FILE_SIZE)} لكل فيديو` : `${queue.length} فيديو • تم ${doneCount}`}
              </p>
            </div>
          </div>
          <button onClick={handleClose} disabled={uploading}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center disabled:opacity-50">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Dropzone */}
          <div {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isDragActive ? "" : "border-white/20 hover:border-opacity-50"}`}
            style={{ borderColor: isDragActive ? settings.primaryColor : undefined, background: isDragActive ? `${settings.primaryColor}10` : undefined }}>
            <input {...getInputProps()} />
            <Flame className="w-12 h-12 mx-auto mb-3" style={{ color: `${settings.primaryColor}50` }} />
            <p className="text-white/80 mb-1">
              {isDragActive ? "أفلت الفيديوهات هنا..." : "اسحب وأفلت فيديوهات هنا (عدد غير محدود)"}
            </p>
            <p className="text-sm text-white/40">أو اضغط لاختيار ملفات • MP4, WebM, OGG, MOV</p>
          </div>

          {/* Global Category */}
          {queue.length > 0 && !uploading && (
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">تصنيف مشترك لكل الفيديوهات</label>
              <div className="flex flex-wrap gap-2">
                {settings.categories.map((cat) => (
                  <button key={cat}
                    onClick={() => {
                      setGlobalCategory(cat);
                      setQueue((prev) => prev.map((x) => x.status === "pending" ? { ...x, category: cat } : x));
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: globalCategory === cat ? `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})` : "rgba(255,255,255,0.05)",
                      color: globalCategory === cat ? "white" : "rgba(255,255,255,0.5)"
                    }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Queue */}
          {queue.length > 0 && (
            <div className="space-y-2">
              {queue.map((item) => (
                <div key={item.id} className="rounded-xl border p-3 transition-all"
                  style={{
                    background: item.status === "done" ? "rgba(34,197,94,0.05)" : item.status === "error" ? "rgba(239,68,68,0.05)" : "rgba(255,255,255,0.03)",
                    borderColor: item.status === "done" ? "rgba(34,197,94,0.2)" : item.status === "error" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)"
                  }}>
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: item.status === "done" ? "rgba(34,197,94,0.2)" : item.status === "error" ? "rgba(239,68,68,0.2)" : item.status === "uploading" ? `${settings.primaryColor}20` : "rgba(255,255,255,0.05)"
                      }}>
                      {item.status === "uploading" ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: settings.primaryColor }} /> :
                       item.status === "done" ? <CheckCircle className="w-5 h-5 text-green-400" /> :
                       item.status === "error" ? <AlertCircle className="w-5 h-5 text-red-400" /> :
                       <Film className="w-5 h-5 text-white/40" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Editable title for pending items */}
                      {item.status === "pending" && !uploading ? (
                        <input type="text" value={item.title}
                          onChange={(e) => updateItem(item.id, { title: e.target.value })}
                          className="w-full bg-transparent text-white font-medium text-sm focus:outline-none border-b border-transparent focus:border-white/20 pb-0.5" />
                      ) : (
                        <p className="text-white font-medium text-sm truncate">{item.title}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                        <span>{formatBytes(item.file.size)}</span>
                        {item.statusText && <><span>•</span><span>{item.statusText}</span></>}
                        {item.error && <span className="text-red-400">{item.error}</span>}
                      </div>
                    </div>

                    {/* Progress or actions */}
                    {item.status === "uploading" ? (
                      <span className="text-sm font-bold shrink-0" style={{ color: settings.primaryColor }}>{item.progress}%</span>
                    ) : item.status === "pending" && !uploading ? (
                      <button onClick={() => removeItem(item.id)} className="w-9 h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center shrink-0">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    ) : null}
                  </div>

                  {/* Progress bar */}
                  {item.status === "uploading" && (
                    <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%`, background: `linear-gradient(90deg, ${settings.primaryColor}, ${settings.accentColor})` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add more button */}
          {queue.length > 0 && !uploading && !allDone && (
            <div {...getRootProps()} className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/10 text-white/40 hover:text-white/60 hover:border-white/20 cursor-pointer transition-all">
              <input {...getInputProps()} />
              <Plus className="w-4 h-4" />
              <span className="text-sm">إضافة فيديوهات أخرى</span>
            </div>
          )}

          {/* All done message */}
          {allDone && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle className="w-7 h-7 text-green-400" />
              <div>
                <p className="text-green-300 font-bold">تم رفع {doneCount} فيديو بنجاح! 🎉</p>
                {errorCount > 0 && <p className="text-red-400 text-sm">فشل رفع {errorCount} فيديو</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t shrink-0" style={{ borderColor: `${settings.primaryColor}15` }}>
          {allDone ? (
            <button onClick={handleClose}
              className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold flex items-center justify-center gap-2 text-lg">
              <CheckCircle className="w-5 h-5" /> إغلاق
            </button>
          ) : (
            <button onClick={startUpload}
              disabled={queue.length === 0 || uploading || queue.every((x) => !x.title.trim())}
              className="w-full py-4 rounded-xl text-white font-bold flex items-center justify-center gap-2 text-lg disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-all"
              style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})`, boxShadow: `0 10px 30px -10px ${settings.primaryColor}50` }}>
              {uploading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> جاري الرفع... ({doneCount}/{queue.length})</>
              ) : (
                <><Upload className="w-5 h-5" /> رفع {queue.length} فيديو</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
