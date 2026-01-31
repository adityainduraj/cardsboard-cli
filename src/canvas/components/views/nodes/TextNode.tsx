"use client";

import * as React from "react";
import { NodeProps, Handle, Position, NodeResizer, type ResizeDragEvent, type ResizeParams, useStore } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import { useNodeSizing, type FrameSizeData } from "../shared/useNodeSizing";
import { TextNodeDrawer } from "./TextNodeDrawer";

export interface TextNodeData {
    content?: string;
    title?: string;
    width?: number;
    height?: number;
    isPending?: boolean;
    isAIGenerated?: boolean;
}

// Extract first H1 from markdown content for the header
function extractTitle(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
}

// Markdown component styles
const markdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#6A6A6A' }}>{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#6A6A6A' }}>{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#6A6A6A' }}>{children}</h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
        <p style={{ marginBottom: 10, lineHeight: 1.5 }}>{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
        <ul style={{ marginLeft: 14, marginBottom: 10, listStyleType: 'disc' }}>{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
        <ol style={{ marginLeft: 14, marginBottom: 10, listStyleType: 'decimal' }}>{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
        <li style={{ marginBottom: 3 }}>{children}</li>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
        <strong style={{ fontWeight: 600 }}>{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
        <em style={{ fontStyle: 'italic' }}>{children}</em>
    ),
    code: ({ children }: { children?: React.ReactNode }) => (
        <code style={{
            backgroundColor: '#F3F3F3',
            padding: '1px 4px',
            borderRadius: 3,
            fontSize: 10,
            fontFamily: 'monospace'
        }}>{children}</code>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
        <blockquote style={{
            borderLeft: '2px solid #E0E0E0',
            paddingLeft: 10,
            marginLeft: 0,
            marginBottom: 10,
            color: '#888888'
        }}>{children}</blockquote>
    ),
};

// Strip the first H1 from content (since it's shown in header)
function stripFirstH1(content: string): string {
    return content.replace(/^#\s+.+\n?/m, '').trim();
}

export const TextNode = React.memo(function TextNode(props: NodeProps) {
    const data = props.data as TextNodeData;
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const [isResizing, setIsResizing] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Subscribe to zoom changes for title fade only
    const zoom = useStore((s) => s.transform[2]);
    const inverseZoom = 1 / Math.abs(zoom);
    const absZoom = Math.abs(zoom);

    const content = typeof data.content === 'string' ? data.content : "";
    const isPending = data.isPending === true;

    // Title logic:
    // 1. If content starts with H1, use that
    // 2. Otherwise use data.title (from classifier)
    // 3. Fallback to "Untitled"
    const extractedTitle = content ? extractTitle(content) : null;
    const title = extractedTitle || data.title || "Untitled";

    // Only strip the H1 if we actually used it as the title
    const displayContent = (content && extractedTitle) ? stripFirstH1(content) : content;

    const { frameSize, handleResize, handleResizeEnd } = useNodeSizing(
        props.id,
        data as FrameSizeData,
        { defaultWidth: 300, defaultHeight: 200 }
    );

    // Track live width during resize for dynamic title truncation
    const [liveWidth, setLiveWidth] = React.useState(frameSize.width);

    React.useEffect(() => {
        setLiveWidth(frameSize.width);
    }, [frameSize.width]);

    React.useEffect(() => {
        if (containerRef.current) {
            containerRef.current.style.width = `${frameSize.width}px`;
            containerRef.current.style.height = `${frameSize.height}px`;
        }
    }, [frameSize.width, frameSize.height]);

    const handleResizeStart = React.useCallback(() => {
        setIsResizing(true);
    }, []);

    const onResizeWrapper = React.useCallback(
        (event: ResizeDragEvent, params: ResizeParams) => {
            if (containerRef.current) {
                containerRef.current.style.width = `${params.width}px`;
                containerRef.current.style.height = `${params.height}px`;
            }
            setLiveWidth(params.width);
            handleResize(event, params);
        },
        [handleResize]
    );

    const onResizeEndWrapper = React.useCallback(
        (event: ResizeDragEvent, params: ResizeParams) => {
            setIsResizing(false);
            handleResizeEnd(event, params);
        },
        [handleResizeEnd]
    );

    const handleEdit = React.useCallback(() => setDrawerOpen(true), []);

    // Resizer handle style - zoom-responsive using counter-transform technique
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

    // Calculate zoom-responsive border width using box-shadow for reliable sub-pixel rendering
    const borderWidth = props.selected ? 2 / absZoom : 1 / absZoom;

    // Title opacity - fade when inside section and zoomed out, OR at extreme zoom for all nodes
    const sectionFade = props.parentId ? Math.max(0, Math.min(1, (absZoom - 0.6) / 0.4)) : 1;
    const extremeZoomFade = Math.max(0, Math.min(1, (absZoom - 0.1) / 0.2));
    const titleOpacity = Math.min(sectionFade, extremeZoomFade);

    return (
        <>
            <NodeResizer
                minWidth={200}
                minHeight={150}
                isVisible={!!props.selected}
                onResizeStart={handleResizeStart}
                onResize={onResizeWrapper}
                onResizeEnd={onResizeEndWrapper}
                handleStyle={resizerHandleStyle}
                autoScale={false}
            />
            <Handle type="target" position={Position.Left} className="!opacity-0" />
            <Handle type="source" position={Position.Right} className="!opacity-0" />

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

            {/* Title - positioned outside, above the node, with negative scaling */}
            {titleOpacity > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        maxWidth: liveWidth * absZoom - 24,
                        marginBottom: 4 / absZoom,
                        pointerEvents: 'none',
                        opacity: titleOpacity,
                        transform: `scale(${inverseZoom})`,
                        transformOrigin: 'bottom left',
                    }}
                >
                    <span
                        style={{
                            fontFamily: "'Manrope', sans-serif",
                            fontWeight: 500,
                            fontSize: 13,
                            letterSpacing: '-0.015em',
                            color: props.selected ? "#3b82f6" : '#898989',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'block',
                        }}
                    >
                        {title}
                    </span>
                </div>
            )}
            {/* Edit icon - positioned on right edge, always visible */}
            {titleOpacity > 0 && (
                <div
                    onClick={handleEdit}
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        right: 0,
                        marginBottom: 4 / absZoom,
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        opacity: titleOpacity * 0.5,
                        transition: 'opacity 0.15s',
                        transform: `scale(${inverseZoom})`,
                        transformOrigin: 'bottom right',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = String(titleOpacity); }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = String(titleOpacity * 0.5); }}
                    title="Edit text"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={props.selected ? "#3b82f6" : "#898989"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3.78181 16.3092L3 21L7.69086 20.2182C8.50544 20.0825 9.25725 19.6956 9.84119 19.1116L20.4198 8.53288C21.1934 7.75922 21.1934 6.5049 20.4197 5.73126L18.2687 3.58024C17.495 2.80658 16.2406 2.80659 15.4669 3.58027L4.88841 14.159C4.30447 14.7429 3.91757 15.4947 3.78181 16.3092Z" />
                        <path d="M14 6L18 10" />
                    </svg>
                </div>
            )}

            {/* Main Container - sharp rectangle, zoom-responsive border */}
            <div
                ref={containerRef}
                style={{
                    width: frameSize.width,
                    height: frameSize.height,
                    minWidth: 200,
                    minHeight: 150,
                    borderRadius: 0,
                    boxShadow: `0 0 0 ${borderWidth}px ${props.selected ? '#3b82f6' : '#E8E8E8'}`,
                    backgroundColor: '#FFFFFF',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    willChange: "auto",
                }}
            >
                {/* Content Area - scrollable when selected */}
                <div
                    style={{
                        flex: 1,
                        padding: 14,
                        paddingTop: 10,
                        overflow: props.selected ? 'auto' : 'hidden',
                        pointerEvents: props.selected ? 'auto' : 'none',
                        fontFamily: "'Manrope', sans-serif",
                        fontWeight: 500,
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: '#6A6A6A',
                    }}
                    className="no-scrollbar"
                >
                    {displayContent ? (
                        <ReactMarkdown components={markdownComponents as any}>
                            {displayContent}
                        </ReactMarkdown>
                    ) : (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: '#C0C0C0',
                            }}
                        >
                            <svg
                                width="32"
                                height="32"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                style={{ marginBottom: 8 }}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                            </svg>
                            <span style={{ fontSize: 11 }}>Click edit icon to edit</span>
                        </div>
                    )}
                </div>
            </div>

            <TextNodeDrawer
                nodeId={props.id}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
            />
        </>
    );
});

export default TextNode;
