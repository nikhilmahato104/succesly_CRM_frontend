import React from "react";
import ReactDOM from "react-dom";


type WarningModalProps = {
  isActive: boolean;
  width?: string;
  title?: string;
  description?: string;
  innerdescription?: string;
  onClose: () => void;
  onProceed: () => void;
};

const WarningModal: React.FC<WarningModalProps> = ({
  isActive,
  width = "420px",
  title = "Unsaved Changes",
  description = "Are you sure you want to leave this page? Any unsaved changes will be lost.",
  innerdescription,
  onClose,
  onProceed,
}) => {
  if (!isActive) return null;

  // Create portal to render modal at the root level to avoid z-index issues
  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" data-portal-popup="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Content */}
      <div
        className="app-modal-panel relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <h3 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Description */}
          {innerdescription ? (
            <div 
              className="text-sm text-gray-600 dark:text-gray-300 mb-6"
              dangerouslySetInnerHTML={{ __html: innerdescription }} 
            />
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{description}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Stay
            </button>
            <button
              onClick={onProceed}
              //apply global color
              style={{ backgroundColor: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white  transition-colors"
            >
              Proceed
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WarningModal;