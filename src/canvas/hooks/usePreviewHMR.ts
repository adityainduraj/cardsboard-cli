/**
 * Hook to handle HMR updates for preview iframes
 * When a generated component changes, reload the iframe
 */

import { useEffect, useRef } from "react";

interface PreviewHMRMessage {
  type: 'generated:updated' | 'component:updated';
  file?: string;
  data?: any;
}

interface UsePreviewHMROptions {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  componentId?: string;
}

/**
 * Hook to handle HMR updates for preview iframes
 * When a generated component changes, reload the iframe to pick up changes
 */
export function usePreviewHMR({ iframeRef, componentId }: UsePreviewHMROptions): void {
  useEffect(() => {
    if (!componentId) return;

    // Create WebSocket connection for HMR updates
    const ws = new WebSocket('ws://localhost:3001/ws');

    ws.onmessage = (event) => {
      try {
        const message: PreviewHMRMessage = JSON.parse(event.data);

        if (message.type === 'generated:updated' && message.file) {
          // Check if this update affects our component
          // The file path will contain the component ID or file name
          if (message.file.includes(componentId) || message.file.includes('generated')) {
            // Reload the iframe to pick up HMR changes
            const iframe = iframeRef.current;
            if (iframe) {
              const currentSrc = iframe.src;
              // Force reload by clearing and resetting src
              iframe.src = '';
              setTimeout(() => {
                iframe.src = currentSrc;
              }, 10);
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse HMR message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [componentId, iframeRef]);
}

/**
 * Simpler version that just returns a callback for manual HMR triggering
 */
export function usePreviewHMRCallback(): (message: PreviewHMRMessage) => void {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001/ws');

    ws.onmessage = (event) => {
      try {
        const message: PreviewHMRMessage = JSON.parse(event.data);

        if (message.type === 'generated:updated' && iframeRef.current) {
          const iframe = iframeRef.current;
          const currentSrc = iframe.src;
          iframe.src = '';
          setTimeout(() => {
            iframe.src = currentSrc;
          }, 10);
        }
      } catch (e) {
        console.error('Failed to parse HMR message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return iframeRef;
}
