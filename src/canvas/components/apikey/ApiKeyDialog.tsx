"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useApiKey } from "@/context/apikey/ApiKeyContext";

export function ApiKeyDialog() {
  const { isSet, setApiKey, showApiKeyDialog, dismissApiKeyDialog } = useApiKey();
  const [inputValue, setInputValue] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  // Only show if dialog is requested AND key is not set
  const shouldShow = showApiKeyDialog && !isSet;

  // Animate in
  useEffect(() => {
    if (shouldShow) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [shouldShow]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim()) {
      setApiKey(inputValue.trim());
      setInputValue("");
    }
  }, [inputValue, setApiKey]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      dismissApiKeyDialog();
    }
  }, [dismissApiKeyDialog]);

  if (!shouldShow || !isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={handleBackdropClick}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        animation: "fadeIn 0.15s ease-out",
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
        style={{
          animation: "slideUp 0.2s ease-out",
        }}
      >
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            OpenRouter API Key Required
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            To use AI features, you need an OpenRouter API key.
          </p>
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            Get your key here →
          </a>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="sk-or-v1-..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={dismissApiKeyDialog}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save Key
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-gray-500">
          Your key is stored locally in your browser and never sent to our servers.
        </p>
      </div>
    </div>
  );
}
