"use client";

import { useRef, useState } from "react";

export type ManualEntryPayload =
  | { kind: "text"; sourceLabel: string; text: string }
  | { kind: "image"; sourceLabel: string; imageData: string };

type Props = {
  onAdd: (payload: ManualEntryPayload) => void;
  onClose: () => void;
};

const MAX_IMAGE_WIDTH = 1200;
const JPEG_QUALITY = 0.85;

function downscaleImage(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("קריאת הקובץ נכשלה"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("טעינת התמונה נכשלה"));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_WIDTH / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("שגיאה בעיבוד התמונה"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function AddManualSourceModal({ onAdd, onClose }: Props) {
  const [tab, setTab] = useState<"text" | "image">("text");

  // Text tab
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  // Image tab
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageError, setImageError] = useState("");
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("יש לבחור קובץ תמונה");
      return;
    }
    setImageError("");
    setProcessing(true);
    try {
      const dataUrl = await downscaleImage(file);
      setImageDataUrl(dataUrl);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "שגיאה בעיבוד התמונה");
    } finally {
      setProcessing(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFile(file);
        return;
      }
    }
  }

  function handleAddText() {
    if (!name.trim() || !text.trim()) return;
    onAdd({ kind: "text", sourceLabel: name.trim(), text: text.trim() });
    onClose();
  }

  function handleAddImage() {
    if (!imageDataUrl) return;
    onAdd({ kind: "image", sourceLabel: imageName.trim() || "תמונה", imageData: imageDataUrl });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-amber-900">הוסף מקור ידנית</h2>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {(["text", "image"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
                tab === t
                  ? "bg-amber-700 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t === "text" ? "טקסט" : "תמונה"}
            </button>
          ))}
        </div>

        {tab === "text" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">שם המקור</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: ספר X, עמוד י"
                dir="rtl"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">טקסט המקור</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                dir="rtl"
                placeholder="הדבק כאן את טקסט המקור..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">כיתוב (אופציונלי)</label>
              <input
                type="text"
                value={imageName}
                onChange={(e) => setImageName(e.target.value)}
                placeholder="לדוגמה: ספר X, עמוד י"
                dir="rtl"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div
              tabIndex={0}
              onPaste={handlePaste}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-sm text-gray-500 cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition min-h-[110px] flex items-center justify-center overflow-hidden outline-none focus:ring-2 focus:ring-amber-400"
            >
              {processing ? (
                "מעבד תמונה..."
              ) : imageDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageDataUrl} alt="" className="max-h-48 max-w-full object-contain" />
              ) : (
                "לחץ כאן ואז הדבק תמונה (Ctrl+V), או לחץ לבחירת קובץ"
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {imageError && <p className="text-xs text-red-500">{imageError}</p>}
            {imageDataUrl && (
              <button
                onClick={() => setImageDataUrl(null)}
                className="text-xs text-gray-500 hover:text-red-500"
              >
                הסר תמונה ובחר אחרת
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={tab === "text" ? handleAddText : handleAddImage}
            disabled={tab === "text" ? !name.trim() || !text.trim() : !imageDataUrl}
            className="flex-1 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
          >
            הוסף
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg transition text-sm"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
