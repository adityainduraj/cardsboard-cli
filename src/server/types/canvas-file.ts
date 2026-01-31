/**
 * Schema for .cardsboard project files
 * These files store complete canvas state locally
 */

import type { Node, Edge } from "@xyflow/react";

/**
 * A .cardsboard file represents a complete canvas state
 * Stored in .cardsboard/canvas/ directory
 */
export interface CardsboardFile {
  $schema: string;
  version: "1.0";
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  nodes: Node[];
  edges: Edge[];
}

/**
 * Canvas registry entry in canvases.json
 */
export interface CanvasRegistryEntry {
  id: string;
  title: string;
  file: string;
  updatedAt: string;
}

/**
 * The canvases.json registry structure
 */
export interface CanvasRegistry {
  activeCanvasId: string | null;
  canvases: CanvasRegistryEntry[];
}

/**
 * Create a new empty canvas file
 */
export function createCanvasFile(title: string): CardsboardFile {
  const now = new Date().toISOString();
  const id = `canvas-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return {
    $schema: "https://cardsboard.app/schema/v1",
    version: "1.0",
    id,
    title,
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
  };
}

/**
 * Generate a filename for a canvas
 */
export function canvasToFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + ".cardsboard"
  );
}
