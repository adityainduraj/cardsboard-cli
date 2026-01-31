import * as React from "react";
import { Node } from "@xyflow/react";
import type { BaseNodeData } from "./types";

// Import node components directly (NOT lazy-loaded) to prevent resize lag
// Lazy loading causes component reference changes which makes React Flow re-initialize nodes
import DesignNode from "../components/views/nodes/DesignNode";
import TextNode from "../components/views/nodes/TextNode";
import SketchNode from "../components/views/nodes/SketchNode";
import ImageNode from "../components/views/nodes/ImageNode";
import SectionNode from "../components/views/nodes/SectionNode";

export interface NodeDefinition {
  type: string;
  label: string;
  icon: React.ReactNode;
  defaultWidth: number;
  defaultHeight: number;
  category: "visual" | "text" | "sketch" | "design" | "container";
  component: React.ComponentType<any>;
  createData: () => BaseNodeData;
}

export const NODE_DEFINITIONS: Record<string, NodeDefinition> = {
  design: {
    type: "design",
    label: "Design",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    defaultWidth: 430,
    defaultHeight: 900,
    category: "design",
    component: DesignNode,
    createData: () => ({
      title: "Design",
      htmlContent: "",
    }),
  },
  sketch: {
    type: "sketch",
    label: "Sketch",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    defaultWidth: 600,
    defaultHeight: 400,
    category: "sketch",
    component: SketchNode,
    createData: () => ({
      title: "Sketch",
      elements: [],
    }),
  },
  text: {
    type: "text",
    label: "Text",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    defaultWidth: 300,
    defaultHeight: 200,
    category: "text",
    component: TextNode,
    createData: () => ({
      title: "Text",
      content: "",
    }),
  },
  image: {
    type: "image",
    label: "Image",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    defaultWidth: 400,
    defaultHeight: 300,
    category: "visual",
    component: ImageNode,
    createData: () => ({
      url: "",
      label: "Image",
    }),
  },
  section: {
    type: "section",
    label: "Section",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    defaultWidth: 400,
    defaultHeight: 300,
    category: "container",
    component: SectionNode,
    createData: () => ({
      sectionName: "Section 1",
      childNodeIds: [],
    }),
  },
};

// PERFORMANCE: Export constant nodeTypes object to prevent ReactFlow re-initialization
// When nodeTypes reference changes, ReactFlow re-initializes ALL nodes causing massive performance issues
export const NODE_TYPES = {
  design: DesignNode,
  sketch: SketchNode,
  text: TextNode,
  image: ImageNode,
  section: SectionNode,
} as const;

export function getNodeTypes() {
  return NODE_TYPES;
}

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS[type];
}

export function getAllNodeDefinitions(): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS);
}

export function createNode(type: string, position: { x: number; y: number }): Node {
  const definition = getNodeDefinition(type);
  if (!definition) {
    throw new Error(`Unknown node type: ${type}`);
  }

  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    position,
    data: definition.createData(),
    width: definition.defaultWidth,
    height: definition.defaultHeight,
  };
}
