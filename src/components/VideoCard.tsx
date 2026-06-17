import { Play, Eye, Clock, Trash2, MoreVertical, Edit3 } from "lucide-react";
import { useState } from "react";
import type { VideoMeta, SiteSettings } from "../lib/db";
import { formatBytes, formatDuration, formatDate, formatViews, updateVideo } from "../lib/db";

interface Props {
  video: VideoMeta;
  settings: SiteSettings;
  isAdmin: boolean;
  onPlay: (video: VideoMeta) => void;
  onDelete: (video: VideoMeta) => void;
  onUpdate: () => void;
}

export default function VideoCard({ video, settings, isAdmin, onPlay, onDelete, onUpdate }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(video.title);
  const [editCategory, setEditCategory] = useState(video.category);

  const handleSave = async () => {
    await updateVideo(video.id, { title: editTitle, category: editCategory });
    setIsEditing(false);
    onUpdate();
  };

  return (
    <div 
      className="group relative rounded-2xl overflow-hidden border border-white/5 transition-all duration-500 hover:border-red-500/30 hover:shadow-2xl hover:shadow-red-500/10 hover:-translate-y-2"
      style={{ 
        background: `linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(15,15,26,0.95) 100%)` 
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-video cursor-pointer overflow-hidden"
        onClick={() => onPlay(video)}
      >
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${settings.primaryColor}20, ${settings.accentColor}20)` }}
          >
            <Play className="w-12 h-12 text-white/20" />
          </div>
        )}

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

        {/* Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center transform scale-50 group-hover:scale-100 transition-all duration-300 shadow-xl"
            style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.accentColor})` }}
          >
            <Play className="w-7 h-7 text-white ml-1" fill="white" />
          </div>
        </div>

        {/* Duration */}
        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-black/80 text-white text-xs font-bold flex items-center gap-1 backdrop-blur-sm">
          <Clock className="w-3 h-3" />
          {formatDuration(video.duration)}
        </div>

        {/* Size */}
        <div className="absolute bottom-3 left-3 px-2 py-1 rounded-lg bg-black/80 text-white/60 text-xs backdrop-blur-sm">
          {formatBytes(video.fileSize)}
        </div>

        {/* Category Badge */}
        <div 
          className="absolute top-3 right-3 px-3 py-1 rounded-full text-white text-xs font-bold backdrop-blur-sm"
          style={{ background: `${settings.primaryColor}cc` }}
        >
          {video.category}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-red-500"
            />
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm focus:outline-none"
            >
              {settings.categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2 rounded-lg bg-white/5 text-white/60 text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-bold"
              >
                حفظ
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <h3
                  onClick={() => onPlay(video)}
                  className="text-white font-bold text-base leading-snug line-clamp-2 cursor-pointer hover:text-red-400 transition-colors mb-2"
                >
                  {video.title}
                </h3>
                
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {formatViews(video.views)}
                  </span>
                  <span>•</span>
                  <span>{formatDate(video.createdAt)}</span>
                </div>
              </div>

              {/* Menu - Admin Only */}
              {isAdmin && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-8 h-8 rounded-lg bg-white/0 hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <MoreVertical className="w-4 h-4 text-white/50" />
                  </button>

                  {showMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                      <div className="absolute top-full right-0 mt-1 z-20 bg-[#2a2a40] rounded-xl border border-white/10 shadow-xl overflow-hidden min-w-[160px]">
                        <button
                          onClick={() => { setShowMenu(false); setIsEditing(true); }}
                          className="w-full px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                          تعديل الفيديو
                        </button>
                        <button
                          onClick={() => { setShowMenu(false); onDelete(video); }}
                          className="w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          حذف الفيديو
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Glow Effect */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${settings.primaryColor}10 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}
