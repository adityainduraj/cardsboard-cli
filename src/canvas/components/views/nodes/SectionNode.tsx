"use client";

import * as React from "react";
import { NodeProps, Handle, Position, useReactFlow, NodeResizer, type ResizeDragEvent, type ResizeParams, useStore } from "@xyflow/react";

export interface SectionNodeData {
  sectionName?: string;
  title?: string;
  frameWidth?: number;
  frameHeight?: number;
  childNodeIds?: string[];
}

export default function SectionNode(props: NodeProps) {
  const data = props.data as SectionNodeData;
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(data.sectionName || "Section 1");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const sectionName = data.sectionName || "Section 1";

  // Subscribe to zoom changes for title fade only
  const zoom = useStore((s) => s.transform[2]);
  const absZoom = Math.abs(zoom);
  const inverseZoom = 1 / absZoom;

  // Calculate zoom-responsive border width using box-shadow for reliable sub-pixel rendering
  const borderWidth = props.selected ? 2 / absZoom : 1 / absZoom;

  // Title opacity - fade out at extreme zoom (below 0.3)
  const titleOpacity = Math.max(0, Math.min(1, (absZoom - 0.1) / 0.2));

  // Zoom-responsive resize handle style - counter-transform to keep handles at constant screen size
  const HANDLE_SIZE_PX = 8;
  const HANDLE_BORDER_PX = 1.5;
  const resizerHandleStyle = React.useMemo(() => ({
    width: HANDLE_SIZE_PX,
    height: HANDLE_SIZE_PX,
    border: `${HANDLE_BORDER_PX}px solid #3b82f6`,
    boxSizing: 'border-box' as const,
    backgroundColor: 'white',
    borderRadius: 0,
    transform: `scale(${inverseZoom})`,
  }), [inverseZoom]);

  // Sync edit value when data changes
  React.useEffect(() => {
    if (!isEditing) {
      setEditValue(data.sectionName || "Section 1");
    }
  }, [data.sectionName, isEditing]);

  const handleDoubleClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  const commitNameChange = React.useCallback(() => {
    setIsEditing(false);
    setNodes((nds) =>
      nds.map((node) =>
        node.id === props.id
          ? { ...node, data: { ...node.data, sectionName: editValue } }
          : node
      )
    );
  }, [editValue, props.id, setNodes]);

  const handleBlur = React.useCallback(() => {
    commitNameChange();
  }, [commitNameChange]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commitNameChange();
    } else if (e.key === "Escape") {
      setEditValue(sectionName);
      setIsEditing(false);
    }
  }, [sectionName, commitNameChange]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Get dimensions from the node
  const width = (data.frameWidth as number) || 400;
  const height = (data.frameHeight as number) || 300;

  // Update container size when dimensions change
  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.width = `${width}px`;
      containerRef.current.style.height = `${height}px`;
    }
  }, [width, height]);

  // Real-time resize handler - updates container visually while dragging
  const handleResize = React.useCallback(
    (_event: ResizeDragEvent, params: ResizeParams) => {
      if (containerRef.current) {
        containerRef.current.style.width = `${params.width}px`;
        containerRef.current.style.height = `${params.height}px`;
      }
    },
    []
  );

  // Resize end handler - commits the size to node data
  const handleResizeEnd = React.useCallback(
    (_event: ResizeDragEvent, params: ResizeParams) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === props.id
            ? {
              ...node,
              data: {
                ...node.data,
                frameWidth: params.width,
                frameHeight: params.height,
              },
              width: params.width,
              height: params.height,
            }
            : node
        )
      );
    },
    [props.id, setNodes]
  );

  return (
    <>
      {/* NodeResizer for manual resizing - with real-time visual updates */}
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={props.selected}
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
        handleStyle={resizerHandleStyle}
        autoScale={false}
      />

      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />

      {/* Section Name - positioned outside, above the section, with negative scaling */}
      {titleOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            width: "100%",
            marginBottom: 4 / absZoom,
            pointerEvents: "none",
            opacity: titleOpacity,
          }}
        >
          <span
            onDoubleClick={handleDoubleClick}
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 500,
              fontSize: 13,
              letterSpacing: "-0.015em",
              color: "#898989",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
              cursor: isEditing ? "text" : "pointer",
              pointerEvents: "auto",
              transform: `scale(${inverseZoom})`,
              transformOrigin: "bottom left",
              maxWidth: width ? `${width / inverseZoom}px` : `${100 / inverseZoom}%`,
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 500,
                  fontSize: 13,
                  letterSpacing: "-0.015em",
                  color: "#898989",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  padding: 0,
                  margin: 0,
                  width: Math.max(60, editValue.length * 8),
                  maxWidth: `${100 / inverseZoom}%`,
                  transform: `scale(${1 / inverseZoom})`,
                  transformOrigin: "bottom left",
                }}
              />
            ) : (
              sectionName
            )}
          </span>
        </div>
      )}

      {/* Section Container - sharp corners, zoom-responsive outline when selected */}
      <div
        ref={containerRef}
        style={{
          width,
          height,
          borderRadius: 0,
          boxShadow: `0 0 0 ${borderWidth}px ${props.selected ? '#3b82f6' : '#E8E8E8'}`,
          backgroundColor: "#FFFFFF",
          position: "relative",
          pointerEvents: "none", // Allow clicks to pass through to cards
        }}
      >
        {/* Invisible border for selection/drag */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 0,
            border: "12px solid transparent",
            pointerEvents: "auto",
            boxSizing: "border-box",
          }}
        />
      </div>
    </>
  );
}
