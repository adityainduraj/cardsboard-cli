"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";

const API_KEY_STORAGE_KEY = "cardsboard_openrouter_api_key";

interface ApiKeyContextType {
  apiKey: string | null;
  isSet: boolean;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  showApiKeyDialog: boolean;
  requestApiKey: () => void;
  dismissApiKeyDialog: () => void;
}

const ApiKeyContext = createContext<ApiKeyContextType | null>(null);

export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<(() => void) | null>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (stored) {
        setApiKeyState(stored);
      }
    } catch {
      // localStorage might not be available
    }
  }, []);

  const setApiKey = useCallback((key: string) => {
    const trimmedKey = key.trim();
    setApiKeyState(trimmedKey);
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, trimmedKey);
    } catch {
      // localStorage might not be available
    }
    // Dismiss dialog if open
    setShowDialog(false);
    setPendingRequest(null);
    // Execute pending request if any
    if (pendingRequest) {
      pendingRequest();
      setPendingRequest(null);
    }
  }, [pendingRequest]);

  const clearApiKey = useCallback(() => {
    setApiKeyState(null);
    try {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    } catch {
      // localStorage might not be available
    }
  }, []);

  const requestApiKey = useCallback(() => {
    setShowDialog(true);
  }, []);

  const dismissApiKeyDialog = useCallback(() => {
    setShowDialog(false);
    setPendingRequest(null);
  }, []);

  const value = useMemo(() => ({
    apiKey,
    isSet: !!apiKey,
    setApiKey,
    clearApiKey,
    showApiKeyDialog: showDialog,
    requestApiKey,
    dismissApiKeyDialog,
  }), [apiKey, setApiKey, clearApiKey, requestApiKey, dismissApiKeyDialog, showDialog]);

  return (
    <ApiKeyContext.Provider value={value}>
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKey() {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error("useApiKey must be used within an ApiKeyProvider");
  }
  return context;
}
