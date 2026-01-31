"use client";

import * as React from "react";
import { useReactFlow } from "@xyflow/react";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";

export interface SketchNodeData {
  previewDataUrl?: string;
  elements?: readonly any[];
  title?: string;
}

interface SketchNodeDrawerProps {
  nodeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SketchNodeDrawer({ nodeId, open, onOpenChange }: SketchNodeDrawerProps) {
  const { getNodes, setNodes } = useReactFlow();
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = React.useState(false);

  // Send initial data to iframe when it's ready
  const sendInitialData = React.useCallback(() => {
    if (!iframeRef.current?.contentWindow || !nodeId) return;

    const node = getNodes().find((n) => n.id === nodeId);
    const nodeData = node?.data as SketchNodeData;
    const elements = nodeData?.elements || [];

    iframeRef.current.contentWindow.postMessage({
      type: "INIT_SKETCH",
      elements: elements,
    }, "*");
  }, [nodeId, getNodes]);

  // Listen for messages from iframe
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SKETCH_READY") {
        setIsReady(true);
        sendInitialData();
      }

      if (event.data?.type === "SKETCH_SAVE") {
        // Save to node data
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? {
                ...node,
                data: {
                  ...node.data,
                  elements: event.data.elements,
                  previewDataUrl: event.data.previewDataUrl
                }
              }
              : node
          )
        );
        onOpenChange(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [nodeId, setNodes, onOpenChange, sendInitialData]);

  // Reset ready state when drawer closes
  React.useEffect(() => {
    if (!open) {
      setIsReady(false);
    }
  }, [open]);

  // Re-send data when nodeId changes and iframe is ready
  React.useEffect(() => {
    if (open && isReady && nodeId) {
      sendInitialData();
    }
  }, [open, isReady, nodeId, sendInitialData]);

  const handleSaveAndClose = React.useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "REQUEST_SAVE" }, "*");
    }
  }, []);

  const handleCancel = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSaveAndClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleSaveAndClose, handleCancel]);

  return (
    <Drawer open={open && !!nodeId} onOpenChange={handleCancel} shouldScaleBackground={true}>
      <DrawerContent
        className="flex flex-col"
        style={{
          height: "calc(100% - 40px)",
          maxHeight: "calc(100% - 40px)",
        }}
      >
        {/* Handle - visual indicator */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div
            className="w-12 h-1.5 rounded-full bg-muted cursor-pointer hover:bg-muted-foreground/20 transition-colors"
            onClick={handleCancel}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-white shrink-0" data-vaul-no-drag="">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="p-2 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500"
              title="Cancel (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div>
              <h2 className="text-sm font-medium text-zinc-900">Edit Sketch</h2>
              <p className="text-xs text-zinc-500">Draw freely, Cmd+S to save</p>
            </div>
          </div>
          <button
            onClick={handleSaveAndClose}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save & Exit
          </button>
        </div>

        {/* Excalidraw Editor via iframe - isolated from parent CSS transforms */}
        <div className="flex-1 relative min-h-0 bg-white overflow-hidden" data-vaul-no-drag="">
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 z-10">
              <div className="flex items-center gap-2 text-zinc-500">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading editor...
              </div>
            </div>
          )}
          {open && (
            <iframe
              ref={iframeRef}
              src="/sketch-editor"
              className="w-full h-full border-none"
              title="Sketch Editor"
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
