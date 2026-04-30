import { useState, useRef } from "react";
import { useApp } from "../context/AppContext";

// ── Cloudinary upload ─────────────────────────────────────────────────────────
async function uploadToCloudinary(file, cloudName, uploadPreset, onProgress) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", uploadPreset);
  fd.append("folder", "documents");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    );

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve({ url: data.secure_url, publicId: data.public_id });
      } else {
        reject(new Error("Upload failed — " + xhr.statusText));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed — network error"));
    xhr.send(fd);
  });
}

function getFileIcon(url) {
  if (!url) return "📎";
  const lower = url.toLowerCase();
  if (lower.includes(".pdf") || lower.includes("/pdf")) return "📄";
  if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg)/)) return "🖼";
  if (lower.match(/\.(doc|docx)/)) return "📝";
  if (lower.match(/\.(xls|xlsx)/)) return "📊";
  return "📎";
}

function getFileName(doc) {
  if (doc.name) return doc.name;
  try {
    const parts = doc.url.split("/");
    return decodeURIComponent(parts[parts.length - 1].split("?")[0]);
  } catch {
    return "Document";
  }
}

// ── Main component ────────────────────────────────────────────────────────────
// Props:
//   documents: [{ url, name, uploadedAt }]
//   onChange: (newDocuments) => void
//   maxFiles: number (default 10)
//   accept: string (default "image/*,.pdf,.doc,.docx")
//   label: string (default "Documents")
export default function DocumentUploader({
  documents = [],
  onChange,
  maxFiles = 10,
  accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx",
  label = "Documents",
  compact = false,
}) {
  const { settings } = useApp();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const cloudName = settings?.cloudinaryCloudName;
  const uploadPreset = settings?.cloudinaryUploadPreset;
  const configured = !!(cloudName && uploadPreset);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!configured) {
      setError(
        "Cloudinary not configured — go to Settings to set up file storage.",
      );
      return;
    }
    if (documents.length >= maxFiles) {
      setError(`Maximum ${maxFiles} files allowed.`);
      return;
    }

    setUploading(true);
    setProgress(0);
    setError("");

    try {
      const { url } = await uploadToCloudinary(
        file,
        cloudName,
        uploadPreset,
        setProgress,
      );
      const newDoc = {
        url,
        name: file.name,
        uploadedAt: Date.now(),
      };
      onChange([...documents, newDoc]);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    }

    setUploading(false);
    setProgress(0);
    // Reset input so same file can be re-uploaded
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDelete = (index) => {
    if (!confirm(`Remove "${getFileName(documents[index])}"?`)) return;
    onChange(documents.filter((_, i) => i !== index));
  };

  if (compact) {
    // ── Compact mode: used inside cards, just shows count + upload button ──
    return (
      <div className="flex items-center gap-2">
        {documents.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {documents.map((doc, i) => (
              <div
                key={i}
                className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5"
              >
                <span className="text-xs">{getFileIcon(doc.url)}</span>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(doc.url, "_blank", "noopener,noreferrer");
                    e.preventDefault();
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline max-w-[120px] truncate"
                >
                  {getFileName(doc)}
                </a>
                <button
                  onClick={() => handleDelete(i)}
                  className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs ml-0.5"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() =>
            configured
              ? inputRef.current?.click()
              : setError("Configure Cloudinary in Settings first.")
          }
          disabled={uploading}
          className="btn-ghost text-xs py-1 px-2 flex-shrink-0"
        >
          {uploading ? `${progress}%` : "📎 Add file"}
        </button>
        {error && (
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  // ── Full mode: used in detail panels ────────────────────────────────────────
  return (
    <div className="space-y-3">
      {!configured && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
          ⚠ File uploads disabled — configure Cloudinary in Settings to enable.
        </div>
      )}

      {/* File list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base flex-shrink-0">
                  {getFileIcon(doc.url)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {getFileName(doc)}
                  </p>
                  {doc.uploadedAt && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(doc.uploadedAt).toLocaleDateString("en-GB")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(doc.url, "_blank", "noopener,noreferrer");
                    e.preventDefault();
                  }}
                  className="btn-ghost text-xs py-1 px-2 text-blue-600 dark:text-blue-400"
                >
                  View ↗
                </a>
                <button
                  onClick={() => handleDelete(i)}
                  className="btn-ghost text-xs py-1 px-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {documents.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          No documents uploaded yet.
        </p>
      )}

      {/* Upload area */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      {uploading ? (
        <div className="space-y-1">
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Uploading… {progress}%
          </p>
        </div>
      ) : (
        <button
          onClick={() =>
            configured
              ? inputRef.current?.click()
              : setError("Configure Cloudinary in Settings first.")
          }
          disabled={documents.length >= maxFiles}
          className={`w-full py-2.5 border-2 border-dashed rounded-lg text-sm transition-colors ${
            configured
              ? "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400"
              : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed"
          }`}
        >
          {documents.length >= maxFiles
            ? `Maximum ${maxFiles} files reached`
            : "📎 Upload document"}
        </button>
      )}

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
