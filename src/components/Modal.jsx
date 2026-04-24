import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ title, onClose, children, size = 'md' }) {
  useEffect(() => {
    const handle = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handle)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handle)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-black/40 w-full ${widths[size]} max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500
                       hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            ✕
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}

export function FormField({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  )
}

export function FormGrid({ cols = 2, children }) {
  const gridCols = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }
  return <div className={`grid ${gridCols[cols]} gap-4`}>{children}</div>
}

export function ModalFooter({ children }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
      {children}
    </div>
  )
}
