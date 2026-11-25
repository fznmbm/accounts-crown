import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function Modal({ title, onClose, children, size = "md" }) {
  // Becomes true as soon as anything is typed or picked inside the modal
  const dirtyRef = useRef(false);
  // Only close on a backdrop click that also STARTED on the backdrop
  // (stops text-selection drags that end outside from closing the modal)
  const downOnBackdropRef = useRef(false);
  const [askDiscard, setAskDiscard] = useState(false);

  // Backdrop, Escape and the X go through here. Save buttons call onClose
  // directly from the page, so they are never asked.
  const requestClose = () => {
    if (dirtyRef.current) setAskDiscard(true);
    else onClose();
  };

  useEffect(() => {
    const handle = (e) => {
      if (e.key !== "Escape") return;
      if (askDiscard) setAskDiscard(false);
      else requestClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose, askDiscard]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const widths = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        downOnBackdropRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdropRef.current)
          requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-black/40 w-full ${widths[size]} max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <button
            onClick={requestClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500
                       hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            ✕
          </button>
        </div>
        {/* Body */}
        <div
          className="overflow-y-auto flex-1 px-6 py-5"
          onInput={() => {
            dirtyRef.current = true;
          }}
        >
          {children}
        </div>

        {/* Discard unsaved changes? */}
        {askDiscard && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-[1px] p-6">
            <div className="w-full max-w-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Discard your changes?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  What you've entered in this form hasn't been saved.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="btn-secondary"
                  onClick={() => setAskDiscard(false)}
                  autoFocus
                >
                  Keep editing
                </button>
                <button className="btn-danger" onClick={onClose}>
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function FormField({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <label className="label">{label}</label>
      {children}
      {hint && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </div>
  );
}

export function FormGrid({ cols = 2, children }) {
  const gridCols = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };
  return <div className={`grid ${gridCols[cols]} gap-4`}>{children}</div>;
}

export function ModalFooter({ children }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
      {children}
    </div>
  );
}
