import { Node, Viewport } from "@xyflow/react";

interface Position {
    x: number;
    y: number;
}

interface ViewportInfo {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
}

/**
 * Convert viewport to flow coordinates for the center of the screen
 */
export function getViewportCenter(
    viewport: Viewport,
    screenWidth: number,
    screenHeight: number
): ViewportInfo {
    const centerX = (-viewport.x + screenWidth / 2) / viewport.zoom;
    const centerY = (-viewport.y + screenHeight / 2) / viewport.zoom;
    return {
        centerX,
        centerY,
        width: screenWidth / viewport.zoom,
        height: screenHeight / viewport.zoom,
    };
}

/**
 * Check if a proposed position overlaps with any existing node
 */
function hasCollision(
    pos: Position,
    width: number,
    height: number,
    nodes: Node[],
    padding: number = 30
): boolean {
    return nodes.some((node) => {
        const nodeWidth = (node.width || (node.data as { frameWidth?: number }).frameWidth || 300) as number;
        const nodeHeight = (node.height || (node.data as { frameHeight?: number }).frameHeight || 200) as number;

        // Check for overlap with padding
        return !(
            pos.x + width + padding < node.position.x ||
            pos.x > node.position.x + nodeWidth + padding ||
            pos.y + height + padding < node.position.y ||
            pos.y > node.position.y + nodeHeight + padding
        );
    });
}

/**
 * Find an empty position using spiral search from a starting point
 */
function findEmptyPosition(
    startX: number,
    startY: number,
    cardWidth: number,
    cardHeight: number,
    nodes: Node[],
    cardIndex: number = 0
): Position {
    const SPACING = 32;

    // For multiple cards, offset horizontally first
    const baseX = startX + cardIndex * (cardWidth + SPACING);

    // If no collision at base position, use it
    if (!hasCollision({ x: baseX, y: startY }, cardWidth, cardHeight, nodes)) {
        return { x: baseX, y: startY };
    }

    // Spiral search outward
    const directions = [
        [1, 0],   // right
        [0, 1],   // down
        [-1, 0],  // left
        [0, -1],  // up
        [1, 1],   // right-down
        [-1, 1],  // left-down
        [1, -1],  // right-up
        [-1, -1], // left-up
    ];

    for (let radius = 1; radius <= 10; radius++) {
        for (const [dx, dy] of directions) {
            const testX = baseX + dx * radius * (cardWidth + SPACING);
            const testY = startY + dy * radius * (cardHeight + SPACING);

            if (!hasCollision({ x: testX, y: testY }, cardWidth, cardHeight, nodes)) {
                return { x: testX, y: testY };
            }
        }
    }

    // Fallback: place below all existing nodes
    let maxY = 0;
    nodes.forEach((node) => {
        const nodeHeight = (node.height || (node.data as { frameHeight?: number }).frameHeight || 200) as number;
        maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    return { x: baseX, y: maxY + SPACING };
}

/**
 * Calculate smart position for AI-generated cards
 * Prefers: near context cards > viewport center > canvas center
 * Always avoids collisions with existing nodes
 */
export function calculateCardPosition(
    existingNodes: Node[],
    contextCardIds: string[],
    cardIndex: number = 0,
    totalCards: number = 1,
    viewport?: { viewport: Viewport; screenWidth: number; screenHeight: number },
    cardWidth: number = 450,
    cardHeight: number = 350
): Position {
    const SPACING = 32;

    // Priority 1: Position relative to context cards
    if (contextCardIds.length > 0) {
        const contextNodes = existingNodes.filter((n) => contextCardIds.includes(n.id));

        if (contextNodes.length > 0) {
            // Find the rightmost and average Y of context nodes
            let maxX = -Infinity;
            let ySum = 0;

            contextNodes.forEach((node) => {
                const nodeWidth = (node.width || (node.data as { frameWidth?: number }).frameWidth || 300) as number;
                maxX = Math.max(maxX, node.position.x + nodeWidth);
                ySum += node.position.y;
            });

            const startX = maxX + SPACING;
            const startY = ySum / contextNodes.length;

            return findEmptyPosition(startX, startY, cardWidth, cardHeight, existingNodes, cardIndex);
        }
    }

    // Priority 2: Position in viewport center
    if (viewport) {
        const viewCenter = getViewportCenter(viewport.viewport, viewport.screenWidth, viewport.screenHeight);

        // Start slightly left of center so cards appear centered
        const startX = viewCenter.centerX - (totalCards * (cardWidth + SPACING)) / 2 + cardIndex * (cardWidth + SPACING);
        const startY = viewCenter.centerY - cardHeight / 2;

        return findEmptyPosition(startX, startY, cardWidth, cardHeight, existingNodes, 0);
    }

    // Priority 3: Position near existing nodes
    if (existingNodes.length > 0) {
        let maxX = -Infinity;
        let minY = Infinity;

        existingNodes.forEach((node) => {
            const nodeWidth = (node.width || (node.data as { frameWidth?: number }).frameWidth || 300) as number;
            maxX = Math.max(maxX, node.position.x + nodeWidth);
            minY = Math.min(minY, node.position.y);
        });

        if (maxX === -Infinity) maxX = 50;
        if (minY === Infinity) minY = 100;

        return findEmptyPosition(maxX + SPACING, minY, cardWidth, cardHeight, existingNodes, cardIndex);
    }

    // Priority 4: Empty canvas - place in center-ish area
    return {
        x: 100 + cardIndex * (cardWidth + SPACING),
        y: 100,
    };
}

/**
 * Calculate positions for multiple variation cards (horizontal layout)
 * All cards are positioned without overlap
 */
export function calculateVariationPositions(
    existingNodes: Node[],
    contextCardIds: string[],
    count: number,
    viewport?: { viewport: Viewport; screenWidth: number; screenHeight: number },
    cardWidth: number = 450,
    cardHeight: number = 350
): Position[] {
    const positions: Position[] = [];

    // Track nodes including ones we're about to place for collision detection
    let nodesWithPlaced = [...existingNodes];

    for (let i = 0; i < count; i++) {
        const pos = calculateCardPosition(
            nodesWithPlaced,
            contextCardIds,
            i,
            count,
            viewport,
            cardWidth,
            cardHeight
        );
        positions.push(pos);

        // Add a virtual node at this position for subsequent collision checks
        nodesWithPlaced = [
            ...nodesWithPlaced,
            {
                id: `virtual-${i}`,
                type: "text",
                position: pos,
                data: { frameWidth: cardWidth, frameHeight: cardHeight },
            } as Node,
        ];
    }

    return positions;
}
