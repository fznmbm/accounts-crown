import { useState, useRef } from 'react'

export default function DropZone({ onFiles, accept = '.pdf', multiple = true, label, sublabel }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handle = (files) => {
    const arr = Array.from(files).filter((f) =>
      accept.split(',').some((ext) => f.name.toLowerCase().endsWith(ext.trim()))
    )
    if (arr.length) onFiles(arr)
  }

  return (
    <div
      onDragOver={(e)  => { e.preventDefault(); setDragging(true) }}
      onDragLeave={()  => setDragging(false)}
      onDrop={(e)      => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files) }}
      onClick={()      => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer select-none transition-colors ${
        dragging
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
      <div className="text-3xl mb-2">📄</div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label || 'Drop PDF files here or click to select'}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        {sublabel || (multiple ? 'You can drop multiple files at once' : 'One file at a time')}
      </p>
    </div>
  )
}
