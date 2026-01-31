"use client";
import { useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/auth/AuthContext";
import { saveCanvas, loadCanvas, type CanvasData } from "@/lib/supabase/canvas";
import type { Node, Edge } from "@xyflow/react";
import { uploadBase64Image } from "@/lib/supabase/canvas";
import { safeValidateCanvasData, sanitizeHtmlContent } from "@/lib/validation/canvas";

interface UseCanvasPersistenceOptions {
  canvasId?: string;
  nodes: Node[];
  edges: Edge[];
  title?: string;
}

/**
 * Hook to handle canvas persistence with Supabase
 * - Manual save only (call save() to persist data)
 * - Handles image uploads (converts base64 to storage)
 * - Loads canvas on mount if canvasId provided
 */
export function useCanvasPersistence({
  canvasId,
  nodes,
  edges,
  title = "Untitled Canvas",
}: UseCanvasPersistenceOptions) {
  const { user, loading: authLoading } = useAuth();
  const currentCanvasIdRef = useRef<string | undefined>(canvasId);

  // Use refs to avoid recreating save callback on every nodes/edges change
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const titleRef = useRef(title);

  // Track uploaded images to avoid re-uploading the same base64 data
  const uploadedImagesRef = useRef<Set<string>>(new Set());

  // Update refs when values change
  useEffect(() => {
    currentCanvasIdRef.current = canvasId;
    nodesRef.current = nodes;
    edgesRef.current = edges;
    titleRef.current = title;
  }, [canvasId, nodes, edges, title]);

  // Save canvas function
  const save = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user || authLoading) {
      return { success: false, error: "Not authenticated" };
    }

    // Read from refs to avoid recreating this callback
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const currentTitle = titleRef.current;

    try {
      // Sanitize HTML content in design nodes
      const sanitizedNodes = currentNodes.map((node) => {
        if (node.type === "design" && node.data?.htmlContent) {
          return {
            ...node,
            data: {
              ...node.data,
              htmlContent: sanitizeHtmlContent(String(node.data.htmlContent)),
            },
          };
        }
        return node;
      });

      // Process images: convert base64 data URLs to uploaded images
      const processedNodes = await Promise.all(
        sanitizedNodes.map(async (node) => {
          // If node has image data as base64, upload it (but skip if already uploaded)
          if (node.type === "image" && typeof node.data?.url === "string" && node.data.url.startsWith("data:")) {
            // Create a unique key for this image based on node ID and a simple hash of the URL
            const imageKey = `${node.id}-${node.data.url.slice(0, 100)}${node.data.url.length}`;

            // Skip if we've already uploaded this exact image
            if (uploadedImagesRef.current.has(imageKey)) {
              return node;
            }

            const canvasId = currentCanvasIdRef.current || "temp";
            try {
              const uploadedUrl = await uploadBase64Image(
                canvasId,
                node.id,
                node.data.url,
                `image-${node.id}.png`
              );
              // Mark this image as uploaded
              uploadedImagesRef.current.add(imageKey);
              return {
                ...node,
                data: {
                  ...node.data,
                  url: uploadedUrl,
                },
              };
            } catch (error) {
              console.error("Failed to upload image:", error);
              // Keep original data URL if upload fails
              return node;
            }
          }
          return node;
        })
      );

      const canvasData: CanvasData = {
        id: currentCanvasIdRef.current,
        user_id: user.id,
        title: currentTitle,
        nodes: processedNodes,
        edges: currentEdges,
      };

      // Validate before saving
      const validation = safeValidateCanvasData(canvasData);
      if (!validation.success) {
        const errorMessage = `Canvas validation failed: ${validation.errors.errors.map(e => e.message).join(", ")}`;
        console.error(errorMessage, validation.errors);
        return { success: false, error: errorMessage };
      }

      const saved = await saveCanvas(canvasData);
      currentCanvasIdRef.current = saved.id;
      
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Failed to save canvas:", error);
      return { success: false, error: message };
    }
  }, [user, authLoading]);

  // Load canvas function
  const load = useCallback(async (id: string) => {
    if (!user || authLoading) return null;

    try {
      const canvas = await loadCanvas(id);
      currentCanvasIdRef.current = canvas.id;
      return canvas;
    } catch (error) {
      console.error("Failed to load canvas:", error);
      return null;
    }
  }, [user, authLoading]);

  return {
    save,
    load,
    canvasId: currentCanvasIdRef.current,
    isReady: !authLoading && !!user,
  };
}




