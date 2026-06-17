import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";
import type { VideoMeta } from "../lib/db";
import { formatBytes, getSettings } from "../lib/db";

interface Props {
  video: VideoMeta | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteModal({ video, isDeleting, onConfirm, onCancel }: Props) {
  if (!video) return null;

  const settings = getSettings();

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      style={{ zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) onCancel(); }}
    >
      <div 
        className="rounded-2xl w-full max-w-md border shadow-2xl p-6 animate-fade-in"
        style={{ 
          background: "linear-gradient(135deg, #1a1a2e, #0f0f1a)",
          borderColor: "rgba(239,68,68,0.3)",
          boxShadow: "0 25px 60px -15px rgba(239,68,68,0.2)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          {/* Icon */}
          <div 
            className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.2)" }}
          >
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>

          <h3 className="text-2xl font-bold text-white mb-2">حذف الفيديو</h3>
          <p className="text-white/50 mb-3">هل أنت متأكد من حذف هذا الفيديو؟</p>
          <p className="font-bold mb-1 truncate" style={{ color: settings.primaryColor }}>
            "{video.title}"
          </p>
          <p className="text-white/30 text-sm mb-6">{formatBytes(video.fileSize)}</p>
          <p className="text-red-400/60 text-xs mb-6">⚠️ سيتم حذف الفيديو نهائياً من السيرفر ولا يمكن استرجاعه</p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 py-3.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center gap-2 transition-all border border-white/10 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
              إلغاء
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-red-600/30"
            >
              {isDeleting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
              {isDeleting ? "جاري الحذف..." : "حذف نهائياً"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
