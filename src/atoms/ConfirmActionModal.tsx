import React, { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { MyButton } from "../atoms/MyButton";
import { AlertCircle, X } from "lucide-react";
import { showToast } from "../atoms/MyToast";

type ConfirmActionModalProps = {
  isActive: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading?: boolean;
  error?: string | null;
};

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isActive,
  title,
  message,
  confirmLabel = "Confirm",
  onClose,
  onConfirm,
  loading = false,
  error = null,
}) => {
  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      showToast.error(err?.message || "Action failed");
    }
  };

  return (
    <Transition appear show={isActive} as={Fragment}>
      <Dialog as="div" className="relative z-[99999]" onClose={onClose}>
        {/* Overlay */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        {/* Modal */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95 translate-y-4"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100 translate-y-0"
            leaveTo="opacity-0 scale-95 translate-y-4"
          >
            <Dialog.Panel className="app-modal-panel w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-2xl transition-all">
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                    {title}
                  </Dialog.Title>
                </div>

                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Message */}
              <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {message}
              </Dialog.Description>

              {/* Error */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex justify-end gap-3">
                <MyButton
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </MyButton>

                <MyButton
                  onClick={handleConfirm}
                  isLoading={loading}
                >
                  {confirmLabel}
                </MyButton>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ConfirmActionModal;
