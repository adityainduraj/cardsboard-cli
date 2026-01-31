/**
 * Hook for managing multiple canvases
 * Handles CRUD operations and switching between canvases
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";

interface CanvasRegistry {
  activeCanvasId: string | null;
  canvases: Array<{
    id: string;
    title: string;
    file: string;
    updatedAt: string;
  }>;
}

interface CanvasData {
  id?: string;
  title: string;
  nodes: Node[];
  edges: Edge[];
  createdAt?: string;
  updatedAt?: string;
}

interface UseCanvasesReturn {
  canvases: CanvasRegistry["canvases"];
  activeCanvasId: string | null;
  activeCanvas: CanvasData | null;
  isLoading: boolean;
  error: string | null;
  createCanvas: (title: string) => Promise<CanvasData>;
  loadCanvas: (id: string) => Promise<CanvasData>;
  switchCanvas: (id: string) => Promise<void>;
  updateCanvas: (id: string, data: Partial<CanvasData>) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;
  renameCanvas: (id: string, newTitle: string) => Promise<void>;
  saveActiveCanvas: (nodes: Node[], edges: Edge[]) => Promise<void>;
  refreshCanvases: () => Promise<void>;
}

export function useCanvases(): UseCanvasesReturn {
  const [registry, setRegistry] = useState<CanvasRegistry>({
    activeCanvasId: null,
    canvases: [],
  });
  const [activeCanvas, setActiveCanvas] = useState<CanvasData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch canvas list
  const refreshCanvases = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/canvases");
      if (!response.ok) throw new Error("Failed to fetch canvases");
      const data: CanvasRegistry = await response.json();
      setRegistry(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refreshCanvases();
  }, [refreshCanvases]);

  // Load active canvas on mount or when activeCanvasId changes
  useEffect(() => {
    if (registry.activeCanvasId) {
      loadCanvas(registry.activeCanvasId);
    }
  }, [registry.activeCanvasId]);

  // Create a new canvas
  const createCanvas = useCallback(async (title: string): Promise<CanvasData> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/canvases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error("Failed to create canvas");
      const newCanvas: CanvasData = await response.json();
      await refreshCanvases();
      return newCanvas;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshCanvases]);

  // Load a specific canvas
  const loadCanvas = useCallback(async (id: string): Promise<CanvasData> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/canvases/${id}`);
      if (!response.ok) throw new Error("Failed to load canvas");
      const canvas: CanvasData = await response.json();
      setActiveCanvas(canvas);
      return canvas;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Switch to a different canvas
  const switchCanvas = useCallback(async (id: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/canvases/${id}/switch`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to switch canvas");
      const canvas: CanvasData = await response.json();
      setActiveCanvas(canvas);
      setRegistry((prev) => ({ ...prev, activeCanvasId: id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update a canvas
  const updateCanvas = useCallback(async (id: string, data: Partial<CanvasData>): Promise<void> => {
    try {
      setError(null);
      const response = await fetch(`/api/canvases/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update canvas");
      await refreshCanvases();
      if (activeCanvas?.id === id) {
        setActiveCanvas((prev) => prev ? { ...prev, ...data } : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    }
  }, [activeCanvas?.id, refreshCanvases]);

  // Delete a canvas
  const deleteCanvas = useCallback(async (id: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/canvases/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete canvas");
      const result = await response.json();
      await refreshCanvases();
      if (result.activeCanvasId) {
        await loadCanvas(result.activeCanvasId);
      } else {
        setActiveCanvas(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadCanvas, refreshCanvases]);

  // Rename a canvas
  const renameCanvas = useCallback(async (id: string, newTitle: string): Promise<void> => {
    await updateCanvas(id, { title: newTitle });
  }, [updateCanvas]);

  // Save the active canvas (debounced)
  const saveActiveCanvas = useCallback((nodes: Node[], edges: Edge[]): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce save to avoid excessive writes
      saveTimeoutRef.current = setTimeout(async () => {
        if (!activeCanvas?.id) {
          resolve();
          return;
        }

        try {
          setError(null);
          const response = await fetch("/api/canvas/active", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: activeCanvas.id,
              nodes,
              edges,
            }),
          });
          if (!response.ok) throw new Error("Failed to save canvas");
          const result = await response.json();
          setActiveCanvas((prev) => prev ? { ...prev, ...result.canvas } : null);
          resolve();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unknown error");
          reject(err);
        }
      }, 300); // 300ms debounce
    });
  }, [activeCanvas]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    canvases: registry.canvases,
    activeCanvasId: registry.activeCanvasId,
    activeCanvas,
    isLoading,
    error,
    createCanvas,
    loadCanvas,
    switchCanvas,
    updateCanvas,
    deleteCanvas,
    renameCanvas,
    saveActiveCanvas,
    refreshCanvases,
  };
}
