import { X } from "lucide-react"
import type { ReactNode } from "react"

interface ModalProps {
  isOpen: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
}

export default function Modal({
  isOpen,
  title,
  children,
  onClose,
  footer,
}: ModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-slate-100"
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X size={20} />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {children}
        </div>

        {footer && (
          <footer className="flex justify-end gap-3 border-t border-slate-800 px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}