import * as React from "react";
import {
    useReactFlow,
    type ResizeDragEvent,
    type ResizeParams,
} from "@xyflow/react";

export interface FrameSizeData {
    frameWidth?: number;
    frameHeight?: number;
}

interface NodeSizingOptions {
    defaultWidth?: number;
    defaultHeight?: number;
}

export function useNodeSizing(
    id: string,
    data: FrameSizeData,
    options?: NodeSizingOptions
) {
    const { setNodes, getNode } = useReactFlow();
    const defaultWidth = options?.defaultWidth ?? 375;
    const defaultHeight = options?.defaultHeight ?? 700;

    // Get initial size from data.frameWidth/frameHeight, or fall back to node's width/height, or defaults
    const getInitialSize = React.useCallback(() => {
        const node = getNode(id);
        const nodeWidth = typeof node?.width === 'number' ? node.width : undefined;
        const nodeHeight = typeof node?.height === 'number' ? node.height : undefined;
        return {
            width: data.frameWidth ?? nodeWidth ?? defaultWidth,
            height: data.frameHeight ?? nodeHeight ?? defaultHeight,
        };
    }, [id, data.frameWidth, data.frameHeight, defaultWidth, defaultHeight, getNode]);

    // Use ref to track size during resize without triggering re-renders
    const initialSize = getInitialSize();
    const sizeRef = React.useRef(initialSize);

    // State only updates on resize end or preset button clicks
    const [frameSize, setFrameSize] = React.useState(initialSize);

    // Sync size when data props change (e.g., when layout is reset)
    // Also sync if node's width/height changes externally
    // PERFORMANCE FIX: Removed getNode from deps - it changes frequently and causes unnecessary re-runs
    React.useEffect(() => {
        const node = getNode(id);
        const nodeWidth = typeof node?.width === 'number' ? node.width : undefined;
        const nodeHeight = typeof node?.height === 'number' ? node.height : undefined;
        const newWidth = data.frameWidth ?? nodeWidth ?? defaultWidth;
        const newHeight = data.frameHeight ?? nodeHeight ?? defaultHeight;
        // Use ref for comparison to avoid stale closure issues
        // sizeRef holds the current actual size
        if (newWidth !== sizeRef.current.width || newHeight !== sizeRef.current.height) {
            sizeRef.current = { width: newWidth, height: newHeight };
            setFrameSize({ width: newWidth, height: newHeight });
        }
    }, [id, data.frameWidth, data.frameHeight, defaultWidth, defaultHeight]);

    // Sync ref with state
    React.useEffect(() => {
        sizeRef.current = frameSize;
    }, [frameSize]);

    const applySize = React.useCallback(
        (width: number, height: number) => {
            sizeRef.current = { width, height };
            setFrameSize({ width, height });

            setNodes((nodes) =>
                nodes.map((node) =>
                    node.id === id
                        ? {
                            ...node,
                            width,
                            height,
                            style: { ...(node.style || {}), width, height },
                            data: {
                                ...node.data,
                                frameWidth: width,
                                frameHeight: height,
                            },
                        }
                        : node
                )
            );
        },
        [id, setNodes]
    );

    // During resize: update ref only (no React state updates = no re-renders)
    const handleResize = React.useCallback(
        (_event: ResizeDragEvent, params: ResizeParams) => {
            sizeRef.current = { width: params.width, height: params.height };
        },
        []
    );

    // On resize end: commit the final size to state
    const handleResizeEnd = React.useCallback(
        (_event: ResizeDragEvent, params: ResizeParams) => {
            setFrameSize({ width: params.width, height: params.height });
            setNodes((nodes) =>
                nodes.map((node) =>
                    node.id === id
                        ? {
                            ...node,
                            width: params.width,
                            height: params.height,
                            style: { ...(node.style || {}), width: params.width, height: params.height },
                            data: {
                                ...node.data,
                                frameWidth: params.width,
                                frameHeight: params.height,
                            },
                        }
                        : node
                )
            );
        },
        [id, setNodes]
    );

    // Get current size (from ref during resize, from state otherwise)
    const getCurrentSize = React.useCallback(() => sizeRef.current, []);

    return {
        frameSize,
        applySize,
        handleResize,
        handleResizeEnd,
        getCurrentSize,
    };
}
