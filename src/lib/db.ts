/**
 * ═══════════════════════════════════════════════════════════════
 * O.F.C - Firebase Realtime Database Video Storage
 * 
 * NO Firebase Storage needed. NO Firestore needed.
 * Videos stored as base64 chunks in Realtime Database.
 * Accessible from ANY device/browser.
 * 
 * Rules needed in Realtime Database:
 * {
 *   "rules": {
 *     ".read": true,
 *     ".write": true
 *   }
 * }
 * ═══════════════════════════════════════════════════════════════
 */

import { initializeApp } from "firebase/app";
import {
  getDatabase, ref, set, get, remove, push, child, update,
} from "firebase/database";

// ═══════════════════════════════════════
// FIREBASE
// ═══════════════════════════════════════
const app = initializeApp({
  apiKey: "AIzaSyCzmwOuO8-OSmNdbxspNN0TnxlCE25DhPQ",
  authDomain: "ofc-1e876.firebaseapp.com",
  databaseURL: "https://ofc-1e876-default-rtdb.firebaseio.com",
  projectId: "ofc-1e876",
  storageBucket: "ofc-1e876.firebasestorage.app",
  messagingSenderId: "110304863999",
  appId: "1:110304863999:web:8a650540722a7185234eca",
});

const rtdb = getDatabase(app);

const CHUNK_SIZE = 800 * 1024; // ~800KB per chunk → ~1.06MB base64 (safe for RTDB)
const SETTINGS_KEY = "ofc_settings";

// ═══════════════════════════════════════
// LIMITS
// ═══════════════════════════════════════
export const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB per video
export const MAX_TOTAL_STORAGE = 6 * 1024 * 1024 * 1024;
export const SUPPORTED_FORMATS = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
export const ADMIN_PASSWORD = "01147497465";

// ═══════════════════════════════════════
// BLOB CACHE
// ═══════════════════════════════════════
const blobCache = new Map<string, string>();

// ═══════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════
export interface SiteSettings {
  siteName: string;
  siteSlogan: string;
  categories: string[];
  primaryColor: string;
  accentColor: string;
  logoEmoji: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "O.F.C",
  siteSlogan: "عالم الفيديو المظلم",
  categories: ["ترفيه", "رعب", "أكشن", "دراما", "تعليم", "رياضة", "تكنولوجيا", "موسيقى", "ألعاب", "أخرى"],
  primaryColor: "#dc2626",
  accentColor: "#7c3aed",
  logoEmoji: "🔥",
};

// Local cache for instant reads
let settingsCache: SiteSettings | null = null;

export function getSettings(): SiteSettings {
  if (settingsCache) return settingsCache;
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) { const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(s) }; settingsCache = parsed; return parsed; }
  } catch {}
  return DEFAULT_SETTINGS;
}

// Load settings from Firebase (for cross-device sync)
export async function loadSettingsFromCloud(): Promise<SiteSettings> {
  try {
    const snap = await get(ref(rtdb, "settings"));
    if (snap.exists()) {
      const cloud = { ...DEFAULT_SETTINGS, ...snap.val() } as SiteSettings;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(cloud));
      settingsCache = cloud;
      return cloud;
    }
  } catch (e) {
    console.warn("Could not load cloud settings:", e);
  }
  return getSettings();
}

// Save settings to both localStorage AND Firebase
export async function saveSettingsToCloud(s: Partial<SiteSettings>): Promise<SiteSettings> {
  const updated = { ...getSettings(), ...s };
  // Save locally
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  settingsCache = updated;
  // Save to Firebase
  try {
    await set(ref(rtdb, "settings"), updated);
  } catch (e) {
    console.warn("Could not save cloud settings:", e);
  }
  return updated;
}

// Keep old function for backward compat but now just local
export function saveSettings(s: Partial<SiteSettings>): SiteSettings {
  const u = { ...getSettings(), ...s };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(u));
  settingsCache = u;
  return u;
}

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════
export interface VideoMeta {
  id: string;
  title: string;
  description: string;
  category: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  duration: number;
  thumbnail: string;
  videoUrl: string;
  storagePath: string;
  totalChunks: number;
  createdAt: number;
  views: number;
}

// ═══════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 بايت";
  const k = 1024;
  const u = ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + u[i];
}

export function formatDuration(s: number): string {
  if (!s || !isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatDate(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60000) return "الآن";
  if (d < 3600000) return `منذ ${Math.floor(d / 60000)} دقيقة`;
  if (d < 86400000) return `منذ ${Math.floor(d / 3600000)} ساعة`;
  if (d < 2592000000) return `منذ ${Math.floor(d / 86400000)} يوم`;
  return new Intl.DateTimeFormat("ar-EG", { year: "numeric", month: "short", day: "numeric" }).format(new Date(ts));
}

export function formatViews(v: number): string {
  if (v < 1000) return `${v} مشاهدة`;
  if (v < 1e6) return `${(v / 1000).toFixed(1)}K مشاهدة`;
  return `${(v / 1e6).toFixed(1)}M مشاهدة`;
}

// ═══════════════════════════════════════
// THUMBNAIL
// ═══════════════════════════════════════
function genThumb(file: File): Promise<{ thumbnail: string; duration: number }> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "metadata";
    const u = URL.createObjectURL(file);
    v.src = u;
    let done = false;
    const fin = (t: string, d: number) => { if (done) return; done = true; URL.revokeObjectURL(u); v.src = ""; resolve({ thumbnail: t, duration: d }); };
    v.onloadedmetadata = () => { v.currentTime = Math.min(2, v.duration * 0.1); };
    v.onseeked = () => {
      try {
        const c = document.createElement("canvas");
        const sc = Math.min(1, 320 / (v.videoWidth || 320));
        c.width = (v.videoWidth || 320) * sc;
        c.height = (v.videoHeight || 180) * sc;
        const ctx = c.getContext("2d");
        if (ctx) { ctx.drawImage(v, 0, 0, c.width, c.height); fin(c.toDataURL("image/jpeg", 0.4), v.duration); }
        else fin("", v.duration || 0);
      } catch { fin("", v.duration || 0); }
    };
    v.onerror = () => fin("", 0);
    setTimeout(() => fin("", 0), 8000);
  });
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

// ═══════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!SUPPORTED_FORMATS.includes(file.type))
    return { valid: false, error: "صيغة غير مدعومة. الصيغ المدعومة: MP4, WebM, OGG, MOV" };
  if (file.size > MAX_FILE_SIZE)
    return { valid: false, error: `حجم الملف (${formatBytes(file.size)}) يتجاوز الحد (${formatBytes(MAX_FILE_SIZE)})` };
  return { valid: true };
}

// ═══════════════════════════════════════
// SAVE VIDEO (Parallel chunk upload for max speed)
// ═══════════════════════════════════════
const PARALLEL_UPLOADS = 6; // Upload 6 chunks at the same time

export async function saveVideo(
  file: File,
  meta: { title: string; description: string; category: string },
  onProgress?: (progress: number, status: string) => void
): Promise<VideoMeta> {
  onProgress?.(2, "جاري إنشاء الصورة المصغرة...");
  const { thumbnail, duration } = await genThumb(file);

  onProgress?.(6, "جاري قراءة الملف...");
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  const totalChunks = Math.ceil(data.length / CHUNK_SIZE);

  const videoId = push(child(ref(rtdb), "videos")).key!;
  
  onProgress?.(10, "جاري رفع الفيديو...");

  // Parallel chunk upload
  let uploaded = 0;
  const uploadChunk = async (i: number) => {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, data.length);
    const b64 = uint8ToBase64(data.slice(start, end));
    await set(ref(rtdb, `chunks/${videoId}/${i}`), b64);
    uploaded++;
    onProgress?.(10 + Math.round((uploaded / totalChunks) * 85), `جاري الرفع... ${uploaded}/${totalChunks}`);
  };

  // Process in parallel batches
  for (let i = 0; i < totalChunks; i += PARALLEL_UPLOADS) {
    const batch = [];
    for (let j = i; j < Math.min(i + PARALLEL_UPLOADS, totalChunks); j++) {
      batch.push(uploadChunk(j));
    }
    await Promise.all(batch);
  }

  // Save metadata
  const videoData = {
    title: meta.title.trim(),
    description: meta.description.trim(),
    category: meta.category,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || "video/mp4",
    duration,
    thumbnail,
    totalChunks,
    createdAt: Date.now(),
    views: 0,
  };

  await set(ref(rtdb, `videos/${videoId}`), videoData);

  onProgress?.(100, "تم الرفع بنجاح!");

  return { id: videoId, ...videoData, videoUrl: "", storagePath: "" };
}

// ═══════════════════════════════════════
// GET ALL VIDEOS
// ═══════════════════════════════════════
export async function getAllVideos(): Promise<VideoMeta[]> {
  const snap = await get(ref(rtdb, "videos"));
  if (!snap.exists()) return [];

  const data = snap.val();
  const videos: VideoMeta[] = [];

  for (const [id, val] of Object.entries(data)) {
    const v = val as any;
    videos.push({
      id,
      title: v.title || "",
      description: v.description || "",
      category: v.category || "أخرى",
      fileName: v.fileName || "",
      fileSize: v.fileSize || 0,
      fileType: v.fileType || "video/mp4",
      duration: v.duration || 0,
      thumbnail: v.thumbnail || "",
      videoUrl: "",
      storagePath: "",
      totalChunks: v.totalChunks || 0,
      createdAt: v.createdAt || Date.now(),
      views: v.views || 0,
    });
  }

  return videos.sort((a, b) => b.createdAt - a.createdAt);
}

// ═══════════════════════════════════════
// GET VIDEO URL → download chunks & combine
// ═══════════════════════════════════════
export async function getVideoUrl(
  videoId: string,
  fileType: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  if (blobCache.has(videoId)) return blobCache.get(videoId)!;

  onProgress?.(5);

  const snap = await get(ref(rtdb, `chunks/${videoId}`));
  if (!snap.exists()) throw new Error("لم يتم العثور على بيانات الفيديو");

  const chunksData = snap.val();
  onProgress?.(15);

  // Get sorted chunk indices
  const indices = Object.keys(chunksData).map(Number).sort((a, b) => a - b);
  const arrays: Uint8Array[] = [];

  for (let i = 0; i < indices.length; i++) {
    const b64 = chunksData[indices[i]] as string;
    arrays.push(base64ToUint8(b64));
    onProgress?.(15 + Math.round(((i + 1) / indices.length) * 80));
  }

  // Combine
  const totalLen = arrays.reduce((s, a) => s + a.length, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    combined.set(arr, offset);
    offset += arr.length;
  }

  const blob = new Blob([combined], { type: fileType || "video/mp4" });
  const url = URL.createObjectURL(blob);
  blobCache.set(videoId, url);

  onProgress?.(100);
  return url;
}

// ═══════════════════════════════════════
// DELETE
// ═══════════════════════════════════════
export async function deleteVideo(id: string): Promise<void> {
  if (blobCache.has(id)) {
    URL.revokeObjectURL(blobCache.get(id)!);
    blobCache.delete(id);
  }
  await remove(ref(rtdb, `videos/${id}`));
  await remove(ref(rtdb, `chunks/${id}`));
}

// ═══════════════════════════════════════
// UPDATE
// ═══════════════════════════════════════
export async function updateVideo(videoId: string, updates: Partial<VideoMeta>): Promise<void> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (k !== "id" && k !== "videoUrl" && k !== "storagePath") clean[k] = v;
  }
  await update(ref(rtdb, `videos/${videoId}`), clean);
}

// ═══════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════
export async function incrementViews(id: string): Promise<void> {
  try {
    const snap = await get(ref(rtdb, `videos/${id}/views`));
    const current = snap.exists() ? (snap.val() as number) : 0;
    await set(ref(rtdb, `videos/${id}/views`), current + 1);
  } catch {}
}

// ═══════════════════════════════════════
// STORAGE INFO
// ═══════════════════════════════════════
export async function getStorageInfo(): Promise<{ used: number; total: number; count: number }> {
  const videos = await getAllVideos();
  return {
    used: videos.reduce((s, v) => s + v.fileSize, 0),
    total: MAX_TOTAL_STORAGE,
    count: videos.length,
  };
}

// ═══════════════════════════════════════
// VISITOR TRACKING
// ═══════════════════════════════════════
export interface Visitor {
  id: string;
  ip: string;
  country: string;
  city: string;
  browser: string;
  os: string;
  device: string;
  language: string;
  screenSize: string;
  referrer: string;
  firstVisit: number;
  lastVisit: number;
  visitCount: number;
}

export async function trackVisitor(): Promise<void> {
  try {
    // Get IP & location from free API
    let ip = "غير معروف", country = "", city = "";
    try {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        ip = data.ip || "غير معروف";
        country = data.country_name || "";
        city = data.city || "";
      }
    } catch {
      try {
        const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
        if (res.ok) { ip = (await res.json()).ip; }
      } catch {}
    }

    const ua = navigator.userAgent;
    const browser = /Firefox/i.test(ua) ? "Firefox" : /Edg/i.test(ua) ? "Edge" : /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : /Opera|OPR/i.test(ua) ? "Opera" : "متصفح آخر";
    const os = /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "macOS" : /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Linux/i.test(ua) ? "Linux" : "غير معروف";
    const device = /Mobile|Android|iPhone/i.test(ua) ? "موبايل" : /Tablet|iPad/i.test(ua) ? "تابلت" : "كمبيوتر";

    const visitorId = ip.replace(/\./g, "_");
    const visitorRef = ref(rtdb, `visitors/${visitorId}`);
    const snap = await get(visitorRef);

    if (snap.exists()) {
      const existing = snap.val();
      await update(visitorRef, {
        lastVisit: Date.now(),
        visitCount: (existing.visitCount || 0) + 1,
        browser, os, device,
      });
    } else {
      await set(visitorRef, {
        ip,
        country,
        city,
        browser,
        os,
        device,
        language: navigator.language || "غير معروف",
        screenSize: `${screen.width}x${screen.height}`,
        referrer: document.referrer || "مباشر",
        firstVisit: Date.now(),
        lastVisit: Date.now(),
        visitCount: 1,
      });
    }
  } catch (e) {
    console.warn("Visitor tracking failed:", e);
  }
}

export async function getVisitors(): Promise<Visitor[]> {
  try {
    const snap = await get(ref(rtdb, "visitors"));
    if (!snap.exists()) return [];
    const data = snap.val();
    return Object.entries(data).map(([id, v]: [string, any]) => ({
      id,
      ip: v.ip || "",
      country: v.country || "",
      city: v.city || "",
      browser: v.browser || "",
      os: v.os || "",
      device: v.device || "",
      language: v.language || "",
      screenSize: v.screenSize || "",
      referrer: v.referrer || "",
      firstVisit: v.firstVisit || 0,
      lastVisit: v.lastVisit || 0,
      visitCount: v.visitCount || 0,
    })).sort((a, b) => b.lastVisit - a.lastVisit);
  } catch { return []; }
}
