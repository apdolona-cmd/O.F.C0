import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload, X, Film, Loader2, CheckCircle, AlertCircle,
  HardDrive, Flame,
} from "lucide-react";
import { saveVideo, validateFile, formatBytes, MAX_FILE_SIZE } from "../lib/db";
import type { SiteSettings } from "../lib/db";

interface Props {
  isOpen: boolean;
  settings: SiteSettings;
  onClose: () => void;
  onComplete: () => void;
}

export default function UploadModal({ isOpen, settings, onClose, onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(settings.categories[0] || "أخرى");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const f = acceptedFiles[0];
    setError("");
    
    const validation = await validateFile(f);
    if (!validation.valid) {
      setError(validation.error || "ملف غير صالح");
      return;
    }
    
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, ""));
    
    const url = URL.createObjectURL(f);
    setPreview(url);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [".mp4", ".webm", ".ogg", ".mov"] },
    maxFiles: 1,
    multiple: false,
    disabled: status === "uploading",
  });

  const handleSubmit = async () => {
    if (!file || !title.trim()) return;

    setStatus("uploading");
    setProgress(0);
    setError("");

    try {
      await saveVideo(file, { title, description, category }, (p, text) => {
        setProgress(p);
        setStatusText(text);
      });

      setStatus("success");
      setTimeout(() => {
        resetForm();
        onComplete();
        onClose();
      }, 1500);
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "فشل في حفظ الفيديو");
    }
  };

  const resetForm = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setTitle("");
    setDescription("");
    setCategory(settings.categories[0] || "أخرى");
    setProgress(0);
    setStatus("idle");
    setStatusText("");
    setError("");
  };

  const handleClose = () => {
    if (status === "uploading") return;
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div 
        className="rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden border shadow-2xl"
        style={{
          background: `linear-gradient(135deg, rgba(26,26,46,0.98) 0%, rgba(15,15,26,0.99) 100%)`,
          borderColor: `${settings.primaryColor}30`,
          boxShadow: `0 25px 50px -12px ${settings.primaryColor}20`
        }}
      >
        {/* Header */}
        <div 
          className="sticky top-0 z-10 flex items-center justify-between p-5 border-b backdrop-blur-sm"
          style={{ 
            borderColor: `${settings.primaryColor}20`,
            background: `linear-gradient(135deg, ${settings.primaryColor}10, ${settings.accentColor}10)`
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})` }}
            >
              <Upload className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">رفع فيديو جديد</h2>
              <p className="text-xs text-white/40">الحد الأقصى: {formatBytes(MAX_FILE_SIZE)}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={status === "uploading"}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(90vh-100px)] space-y-5">
          {/* Dropzone */}
          {!file ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
                isDragActive ? "border-opacity-100 bg-opacity-10" : "border-white/20 hover:border-opacity-50"
              }`}
              style={{ 
                borderColor: isDragActive ? settings.primaryColor : undefined,
                background: isDragActive ? `${settings.primaryColor}10` : undefined 
              }}
            >
              <input {...getInputProps()} />
              <Flame className="w-16 h-16 mx-auto mb-4" style={{ color: `${settings.primaryColor}50` }} />
              <p className="text-lg text-white/80 mb-2">
                {isDragActive ? "أفلت الفيديو هنا..." : "اسحب وأفلت الفيديو هنا"}
              </p>
              <p className="text-sm text-white/40">أو اضغط لاختيار ملف • MP4, WebM, OGG, MOV</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border border-white/10">
              {preview && (
                <div className="aspect-video bg-black relative">
                  <video src={preview} className="w-full h-full object-contain" controls />
                </div>
              )}
              <div className="p-4 bg-white/5 flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${settings.primaryColor}20` }}
                >
                  <Film className="w-6 h-6" style={{ color: settings.primaryColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{file.name}</p>
                  <p className="text-sm text-white/50">{formatBytes(file.size)}</p>
                </div>
                {status === "idle" && (
                  <button
                    onClick={resetForm}
                    className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5 text-red-400" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Form Fields */}
          {file && status !== "success" && (
            <>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  عنوان الفيديو <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="أدخل عنوان الفيديو..."
                  disabled={status === "uploading"}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none transition-colors disabled:opacity-50"
                  style={{ borderColor: title ? `${settings.primaryColor}50` : undefined }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">الوصف</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="أدخل وصف الفيديو..."
                  rows={3}
                  disabled={status === "uploading"}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none transition-colors resize-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">التصنيف</label>
                <div className="flex flex-wrap gap-2">
                  {settings.categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      disabled={status === "uploading"}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50`}
                      style={{
                        background: category === cat 
                          ? `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})`
                          : "rgba(255,255,255,0.05)",
                        color: category === cat ? "white" : "rgba(255,255,255,0.6)"
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Progress */}
          {status === "uploading" && (
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: settings.primaryColor }} />
                  <span className="text-white/80">{statusText}</span>
                </div>
                <span className="font-bold text-lg" style={{ color: settings.primaryColor }}>{progress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ 
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${settings.primaryColor}, ${settings.accentColor})`
                  }}
                />
              </div>
            </div>
          )}

          {/* Success */}
          {status === "success" && (
            <div className="flex items-center gap-4 p-5 rounded-2xl bg-green-500/10 border border-green-500/20">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-green-300 font-bold text-lg">تم رفع الفيديو بنجاح! 🔥</p>
                <p className="text-green-300/60 text-sm">سيتم إغلاق النافذة تلقائياً...</p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          {status !== "success" && file && (
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || status === "uploading"}
              className="w-full py-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              style={{ 
                background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})`,
                boxShadow: `0 10px 30px -10px ${settings.primaryColor}50`
              }}
            >
              <HardDrive className="w-5 h-5" />
              {status === "uploading" ? "جاري الحفظ..." : "حفظ الفيديو"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
