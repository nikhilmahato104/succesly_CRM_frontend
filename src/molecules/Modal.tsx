import React, { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";
import { MyButton } from "../atoms/MyButton";
import { clsx } from "clsx";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = "md",
  showCloseButton = true 
}) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      {/* <Dialog as="div" className="relative z-50" onClose={onClose}> */}
      <Dialog as="div" className="relative z-[999999]" onClose={onClose}>
        {/* Backdrop - exact same as DeleteModal */}
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

        {/* Centering container - exact same as DeleteModal */}
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
            <Dialog.Panel
              className={clsx(
                "app-modal-panel w-full rounded-xl bg-white dark:bg-gray-800 shadow-2xl transition-all overflow-hidden mx-auto",
                {
                  "max-w-sm": size === "sm",
                  "max-w-md": size === "md", 
                  "max-w-lg": size === "lg",
                  "max-w-4xl": size === "xl",
                }
              )}
            >
              {/* Header with close button - exactly like DeleteModal */}
              {(title || showCloseButton) && (
                <div className="flex justify-between items-start px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    {title && (
                      <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                        {title}
                      </Dialog.Title>
                    )}
                  </div>
                  
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}

              {/* Content area with proper padding */}
              <div className={clsx(
                "max-h-[calc(100vh-8rem)] overflow-y-auto",
                {
                  "p-6": !title && !showCloseButton,
                  "px-6 py-4": title || showCloseButton,
                }
              )}>
                {children}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default Modal;