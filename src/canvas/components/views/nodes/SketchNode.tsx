import { NodeProps } from "@xyflow/react";
import { BaseNode } from "../shared/BaseNode";

export interface SketchNodeData {
  title?: string;
  previewDataUrl?: string;
  elements?: any[];
  frameWidth?: number;
  frameHeight?: number;
}

// Simple SVG helper for immediate preview - matches ~/cardsboard exactly
function SimpleSvgPreview({ elements }: { elements: any[] }) {
  if (!elements || elements.length === 0) return null;

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  elements.forEach(el => {
    // Simple bounds check (ignores rotation/complex shapes for speed)
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + (el.width || 0));
    maxY = Math.max(maxY, el.y + (el.height || 0));
  });

  const padding = 40;
  const width = maxX - minX;
  const height = maxY - minY;
  // Default to reasonable box if empty
  const vbX = minX === Infinity ? 0 : minX - padding;
  const vbY = minY === Infinity ? 0 : minY - padding;
  const vbW = width <= 0 ? 500 : width + padding * 2;
  const vbH = height <= 0 ? 500 : height + padding * 2;

  return (
    <svg viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} className="w-full h-full" style={{ overflow: 'visible' }}>
      {elements.map((el) => {
        const strokeColor = el.strokeColor || "#1e1e1e";
        const strokeWidth = el.strokeWidth || 1;
        const fillStyle = el.backgroundColor !== "transparent" ? el.backgroundColor : "none";

        switch (el.type) {
          case "rectangle":
            return (
              <rect
                key={el.id}
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                fill={fillStyle}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                rx={el.roundness ? 5 : 0}
              />
            );
          case "ellipse":
            return (
              <ellipse
                key={el.id}
                cx={el.x + el.width / 2}
                cy={el.y + el.height / 2}
                rx={el.width / 2}
                ry={el.height / 2}
                fill={fillStyle}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            );
          case "diamond":
            // Draw diamond path
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            const d = `M ${cx} ${el.y} L ${el.x + el.width} ${cy} L ${cx} ${el.y + el.height} L ${el.x} ${cy} Z`;
            return (
              <path
                key={el.id}
                d={d}
                fill={fillStyle}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            );
          case "line":
          case "arrow":
            if (!el.points || el.points.length === 0) return null;
            let pd = `M ${el.x + el.points[0][0]} ${el.y + el.points[0][1]}`;
            for (let i = 1; i < el.points.length; i++) {
              pd += ` L ${el.x + el.points[i][0]} ${el.y + el.points[i][1]}`;
            }
            return (
              <g key={el.id}>
                <path d={pd} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
                {el.type === "arrow" && (
                  // Simple arrowhead approximation at last point
                  <circle
                    cx={el.x + el.points[el.points.length - 1][0]}
                    cy={el.y + el.points[el.points.length - 1][1]}
                    r={3}
                    fill={strokeColor}
                  />
                )}
              </g>
            );
          case "text":
            return (
              <text
                key={el.id}
                x={el.x}
                y={el.y + (el.fontSize || 20)}
                fill={strokeColor}
                fontSize={el.fontSize || 20}
                fontFamily="Virgil"
                style={{ whiteSpace: "pre" }}
              >
                {el.text}
              </text>
            );
          default:
            return null;
        }
      })}
    </svg>
  );
}

export default function SketchNode(props: NodeProps) {
  const previewUrl = props.data.previewDataUrl as string | undefined;
  const sketchName = props.data.title as string || "Untitled Sketch";
  // Check for elements if preview is missing
  const elements = props.data.elements as any[] | undefined;

  return (
    <BaseNode
      id={props.id}
      data={props.data}
      selected={props.selected}
      minWidth={200}
      minHeight={150}
      customContainerStyle={{ cursor: 'pointer' }}
    >
      <div className="w-full h-full p-4 flex flex-col items-center justify-center relative bg-white">
        {/* PNG preview takes priority, then SVG fallback */}
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Sketch Preview"
            className="max-w-full max-h-full object-contain pointer-events-none select-none"
          />
        ) : elements && elements.length > 0 ? (
          <div className="w-full h-full pointer-events-none select-none opacity-80">
            <SimpleSvgPreview elements={elements} />
          </div>
        ) : (
          <div className="text-zinc-300 flex flex-col items-center select-none">
            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="text-sm">Double click to edit</span>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
