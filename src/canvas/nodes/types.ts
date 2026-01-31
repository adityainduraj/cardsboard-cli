export interface BaseNodeData {
  title?: string;
  frameWidth?: number;
  frameHeight?: number;
  [key: string]: unknown;
}

export interface DesignNodeData extends BaseNodeData {
  htmlContent?: string;
  isPlaceholder?: boolean;

  // NEW: React preview fields (optional)
  componentId?: string;          // Reference to generated component
  componentFile?: string;        // Relative path to .tsx file
  previewMode?: 'html' | 'react';  // Render mode (defaults to 'html')
  previewProps?: Record<string, any>;  // Props for component
  isGenerated?: boolean;         // True if AI-generated
}

export interface SketchNodeData extends BaseNodeData {
  previewDataUrl?: string;
  elements?: any[];
}

export interface TextNodeData extends BaseNodeData {
  content?: string;
}

export interface ImageNodeData extends BaseNodeData {
  url?: string;
  label?: string;
}

export interface SectionNodeData extends BaseNodeData {
  sectionName?: string;
  childNodeIds?: string[];
}
