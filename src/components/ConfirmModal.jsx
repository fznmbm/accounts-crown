import Modal, { ModalFooter } from "./Modal";

const TYPE_CONFIG = {
  danger: {
    icon: "🗑",
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
    btnClass: "btn-danger",
  },
  warning: {
    icon: "⚠",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    btnClass:
      "px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors",
  },
  info: {
    icon: "→",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    btnClass: "btn-primary",
  },
};

export default function ConfirmModal({
  title,
  message,
  type = "danger",
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.danger;

  return (
    <Modal title="" onClose={onCancel} size="sm">
      <div className="flex items-start gap-3 pb-2">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg ${config.iconBg}`}
        >
          <span className={config.iconColor}>{config.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {title}
          </p>
          {message && (
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {message}
            </p>
          )}
        </div>
      </div>
      <ModalFooter>
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className={config.btnClass} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
