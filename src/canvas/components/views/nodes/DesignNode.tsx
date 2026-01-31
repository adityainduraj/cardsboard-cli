import { NodeProps } from "@xyflow/react";
import { useRef } from "react";
import { BaseNode } from "../shared/BaseNode";
import { usePreviewHMR } from "@/hooks/usePreviewHMR";

export interface DesignNodeData {
  title?: string;
  htmlContent?: string;
  frameWidth?: number;
  frameHeight?: number;
  componentId?: string;
  componentFile?: string;
  previewMode?: 'html' | 'react';
  previewProps?: Record<string, any>;
  isGenerated?: boolean;
}

export default function DesignNode(props: NodeProps) {
  const data = props.data as DesignNodeData;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check if this should render as a React preview
  const isReactPreview = data.previewMode === 'react' && data.componentId;

  // Enable HMR for React previews
  usePreviewHMR({ iframeRef, componentId: data.componentId });

  return (
    <BaseNode
      id={props.id}
      data={props.data}
      selected={props.selected}
      minWidth={280}
      minHeight={250}
    >
      <div className="w-full h-full overflow-auto">
        {isReactPreview ? (
          // React component preview (iframe)
          <iframe
            ref={iframeRef}
            src={`/preview/${data.componentId}`}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title={data.title || 'Component Preview'}
          />
        ) : data.htmlContent ? (
          // HTML rendering (existing behavior)
          <div
            className="w-full h-full"
            dangerouslySetInnerHTML={{ __html: data.htmlContent }}
          />
        ) : (
          // Empty state
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">🎨</div>
              <div>Double click to edit</div>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
