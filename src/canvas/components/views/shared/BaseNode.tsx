import * as React from "react";
import {
    Handle,
    Position,
    NodeResizer,
    type ResizeDragEvent,
    type ResizeParams,
    useStore,
} from "@xyflow/react";
import { useNodeSizing, type FrameSizeData } from "./useNodeSizing";
import type { BaseNodeData } from "@/nodes/types";

export interface BaseNodeProps {
    id: string;
    data: BaseNodeData;
    selected: boolean;
    dragging?: boolean;
    children: React.ReactNode;
    toolbarActions?: React.ReactNode;
    onResizeStart?: () => void;
    onResizeEnd?: (width: number, height: number) => void;
    minWidth?: number;
    minHeight?: number;
    customContainerStyle?: React.CSSProperties;
    className?: string;
    hideLabel?: boolean;
    floatingMenu?: React.ReactNode;
}

export const BaseNode = React.memo(function BaseNode({
    id,
    data,
    selected,
    minWidth = 200,
    minHeight = 150,
    children,
    customContainerStyle,
    className,
    toolbarActions,
    onResizeStart,
    onResizeEnd,
    hideLabel,
    floatingMenu,
}: BaseNodeProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = React.useState(false);

    // Get zoom level for title fade only (not for handles)
    const zoom = useStore((s) => s.transform[2]);
    const absZoom = Math.abs(zoom);
    const inverseZoom = 1 / absZoom;
    const isInsideSection = !!(data as { parentSectionId?: string }).parentSectionId;

    // Fade opacity - inside section fades at 0.6-1.0, all nodes fade below 0.3 zoom (extreme)
    const sectionFade = isInsideSection ? Math.max(0, Math.min(1, (absZoom - 0.6) / 0.4)) : 1;
    const extremeZoomFade = Math.max(0, Math.min(1, (absZoom - 0.1) / 0.2));
    const titleOpacity = Math.min(sectionFade, extremeZoomFade);

    const { frameSize, handleResize, handleResizeEnd } = useNodeSizing(
        id,
        data as FrameSizeData,
        { defaultWidth: minWidth, defaultHeight: minHeight }
    );

    React.useEffect(() => {
        if (containerRef.current) {
            containerRef.current.style.width = `${frameSize.width}px`;
            containerRef.current.style.height = `${frameSize.height}px`;
        }
    }, [frameSize.width, frameSize.height]);

    const handleResizeStart = React.useCallback(() => {
        setIsResizing(true);
        onResizeStart?.();
    }, [onResizeStart]);

    const onResizeWrapper = React.useCallback(
        (event: ResizeDragEvent, params: ResizeParams) => {
            if (containerRef.current) {
                containerRef.current.style.width = `${params.width}px`;
                containerRef.current.style.height = `${params.height}px`;
            }
            handleResize(event, params);
        },
        [handleResize]
    );

    const onResizeEndWrapper = React.useCallback(
        (event: ResizeDragEvent, params: ResizeParams) => {
            setIsResizing(false);
            handleResizeEnd(event, params);
            onResizeEnd?.(params.width, params.height);
        },
        [handleResizeEnd, onResizeEnd]
    );

    const title = (data.title as string) || "Node";
    const isPending = (data as { isPending?: boolean }).isPending === true;

    // Calculate zoom-responsive border width using box-shadow for reliable sub-pixel rendering
    const borderWidth = selected ? 2 / absZoom : 1 / absZoom;

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

    return (
        <>
            <NodeResizer
                minWidth={minWidth}
                minHeight={minHeight}
                isVisible={!!selected}
                onResizeStart={handleResizeStart}
                onResize={onResizeWrapper}
                onResizeEnd={onResizeEndWrapper}
                handleStyle={resizerHandleStyle}
                autoScale={false}
            />
            <Handle type="target" position={Position.Left} className="!opacity-0" />
            <Handle type="source" position={Position.Right} className="!opacity-0" />

            {/* Custom floating menu */}
            {floatingMenu}

            {/* Gradient loading overlay */}
            {isPending && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        pointerEvents: "none",
                        zIndex: 1,
                        borderRadius: 0,
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: "linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent)",
                            backgroundSize: "200% 100%",
                            animation: "gradientMove 1.5s ease-in-out infinite",
                        }}
                    />
                    <style>{`
                        @keyframes gradientMove {
                            0% { background-position: 200% 0; }
                            100% { background-position: -200% 0; }
                        }
                    `}</style>
                </div>
            )}

            {/* Title - always visible, positioned outside, above the node, with negative scaling */}
            {!hideLabel && titleOpacity > 0 && (
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
                        style={{
                            fontFamily: "'Manrope', sans-serif",
                            fontWeight: 500,
                            fontSize: 13,
                            letterSpacing: "-0.015em",
                            color: selected ? "#3b82f6" : "#898989",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "block",
                            transform: `scale(${inverseZoom})`,
                            transformOrigin: "bottom left",
                            maxWidth: `${100 / inverseZoom}%`,
                        }}
                    >
                        {title}
                    </span>
                </div>
            )}

            {/* Container with border */}
            <div
                ref={containerRef}
                className={`bg-white relative overflow-hidden ${className}`}
                style={{
                    width: frameSize.width,
                    height: frameSize.height,
                    minWidth,
                    minHeight,
                    boxShadow: `0 0 0 ${borderWidth}px ${selected ? '#3b82f6' : '#e4e4e7'}`,
                    borderRadius: 0,
                    willChange: "auto",
                    ...customContainerStyle,
                }}
            >
                {children}
            </div>
        </>
    );
});
