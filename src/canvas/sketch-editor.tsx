"use client";

import * as React from "react";
import { createRoot } from "react-dom/client";

// Import Excalidraw CSS - supported in 0.18.0
import "@excalidraw/excalidraw/index.css";
import "./index.css";

// Ensure process is defined globally for Excalidraw
if (typeof window !== "undefined" && !window.process) {
  (window as any).process = { env: { NODE_ENV: "development" } };
}

// Direct import for reliability in CLI/iframe environment
import { Excalidraw, exportToCanvas } from "@excalidraw/excalidraw";

function SketchEditorPage() {
  const excalidrawApiRef = React.useRef<any>(null);
  const [isReady, setIsReady] = React.useState(false);
  const [initialElements, setInitialElements] = React.useState<any[]>([]);
  const hasInitialized = React.useRef(false);

  console.log("SketchEditorPage rendering, isReady:", isReady);

  // Listen for messages from parent
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "INIT_SKETCH") {
        const elements = event.data.elements || [];
        setInitialElements(elements);

        // If already ready, update the scene
        if (excalidrawApiRef.current && hasInitialized.current) {
          excalidrawApiRef.current.updateScene({
            elements: elements,
            appState: { viewBackgroundColor: "#ffffff" },
          });
          excalidrawApiRef.current.scrollToContent();
        }
      }

      if (event.data?.type === "REQUEST_SAVE") {
        handleSave();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // When Excalidraw becomes ready and we have initial elements, load them
  React.useEffect(() => {
    if (isReady && excalidrawApiRef.current && !hasInitialized.current) {
      hasInitialized.current = true;
      if (initialElements.length > 0) {
        excalidrawApiRef.current.updateScene({
          elements: initialElements,
          appState: { viewBackgroundColor: "#ffffff" },
        });
        excalidrawApiRef.current.scrollToContent();
      }
      // Notify parent that we're ready
      window.parent.postMessage({ type: "SKETCH_READY" }, "*");
    }
  }, [isReady, initialElements]);

  const handleSave = React.useCallback(async () => {
    if (!excalidrawApiRef.current) return;

    const elements = excalidrawApiRef.current.getSceneElements();
    let previewDataUrl: string | null = null;

    if (elements && elements.length > 0) {
      try {
        const { exportToCanvas } = await import("@excalidraw/excalidraw");
        const canvas = await exportToCanvas({
          elements,
          appState: {
            viewBackgroundColor: "#ffffff",
            exportWithDarkMode: false,
          },
          files: excalidrawApiRef.current.getFiles(),
          maxWidthOrHeight: 800,
        });
        previewDataUrl = canvas.toDataURL("image/png");
      } catch (err) {
        console.error("Failed to export preview:", err);
      }
    }

    // Send data back to parent
    window.parent.postMessage({
      type: "SKETCH_SAVE",
      elements: elements,
      previewDataUrl: previewDataUrl,
    }, "*");
  }, []);

  return (
    <div className="w-full h-screen bg-white">
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
      <Excalidraw
        excalidrawAPI={(api: any) => {
          console.log("Excalidraw API ready callback fired");
          excalidrawApiRef.current = api;
          setIsReady(true);
        }}
        initialData={{
          elements: [],
          appState: {
            viewBackgroundColor: "#ffffff",
          },
        }}
      />
    </div>
  );
}

// Fallback to error display if Excalidraw fails
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-500 bg-red-50 h-screen overflow-auto">
          <h1 className="font-bold">Failed to load editor</h1>
          <pre className="text-xs mt-2">{this.state.error?.toString()}</pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-3 py-1 bg-red-600 text-white rounded"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("sketch-root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <ErrorBoundary>
      <SketchEditorPage />
    </ErrorBoundary>
  );
} else {
  console.error("No sketch-root element found");
}
