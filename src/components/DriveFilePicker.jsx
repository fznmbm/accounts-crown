import { useState } from "react";
import { openDrivePicker } from "../lib/googleDrive";

export default function DriveFilePicker({
  documents = [],
  onChange,
  label = "Documents",
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pick = async () => {
    setLoading(true);
    setError("");
    try {
      await openDrivePicker({
        onPicked: (file) => {
          const already = documents.some((d) => d.id === file.id);
          if (!already) onChange([...documents, file]);
        },
        mimeTypes:
          "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png",
      });
    } catch (e) {
      setError("Could not open Google Drive. Make sure pop-ups are allowed.");
      console.error(e);
    }
    setLoading(false);
  };

  const remove = (id) => onChange(documents.filter((d) => d.id !== id));

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes("pdf")) return "📄";
    if (mimeType?.includes("image")) return "🖼️";
    if (mimeType?.includes("word")) return "📝";
    return "📎";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <button
          type="button"
          onClick={pick}
          disabled={loading}
          className="btn-ghost text-xs flex items-center gap-1"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="text-blue-500"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
              fill="currentColor"
            />
          </svg>
          {loading ? "Opening Drive…" : "+ Add from Google Drive"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      {documents.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          No documents linked yet. Click "Add from Google Drive" to attach
          files.
        </p>
      ) : (
        <div className="space-y-1.5">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700"
            >
              <span className="text-base flex-shrink-0">
                {getFileIcon(doc.mimeType)}
              </span>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex-1 truncate"
              >
                {doc.name}
              </a>
              <button
                type="button"
                onClick={() => remove(doc.id)}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-sm flex-shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
