import React, { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Key, AlertCircle } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { MyButton } from "./MyButton";
import {
  setApiKey,
  selectApiKeyModalOpen,
  selectApiKeyIsInvalid,
  selectApiKeyLimitExceeded,
} from "../store/slices/apiKeySlice";

const AUTH_ROUTES = ["/login", "/forgot-password", "/auth/"];

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((r) => pathname.startsWith(r));
}

const ApiKeyModal: React.FC = () => {
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const isOpen = useSelector(selectApiKeyModalOpen);
  const isInvalid = useSelector(selectApiKeyIsInvalid);
  const limitExceeded = useSelector(selectApiKeyLimitExceeded);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  if (isAuthRoute(pathname)) return null;

  const handleSave = () => {
    if (!inputValue.trim()) {
      setError("API key is required");
      return;
    }
    dispatch(setApiKey(inputValue.trim()));
    setInputValue("");
    setError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (error) setError("");
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[99999]" onClose={() => {}}>
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
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-[var(--primary-light)] rounded-lg">
                  <Key className="h-5 w-5 text-[var(--primary)]" />
                </div>
                <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                  API Key Required
                </Dialog.Title>
              </div>

              <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {limitExceeded
                  ? "Your API key usage limit has been exceeded. Please enter a new API key to continue."
                  : isInvalid
                  ? "Your API key is invalid or expired. Please enter a valid key to continue."
                  : "Enter your platform API key to access this section."}
              </Dialog.Description>

              {/* Limit exceeded warning */}
              {limitExceeded && (
                <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                  <span className="text-sm text-orange-600 dark:text-orange-400">
                    API key usage limit exceeded. Please enter a new API key.
                  </span>
                </div>
              )}

              {/* Invalid key warning */}
              {isInvalid && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <span className="text-sm text-red-600 dark:text-red-400">
                    The previous key was rejected by the server.
                  </span>
                </div>
              )}

              {/* Input */}
              <input
                type="text"
                value={inputValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Paste your x-api-key here"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                autoFocus
              />

              {error && (
                <p className="text-xs text-red-500 mt-1">{error}</p>
              )}

              <div className="mt-6 flex justify-end">
                <MyButton
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleSave}
                  className="min-w-[120px]"
                >
                  Save & Continue
                </MyButton>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ApiKeyModal;
