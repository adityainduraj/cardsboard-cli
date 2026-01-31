export interface BaseNodeData {
  title?: string;
  frameWidth?: number;
  frameHeight?: number;
  [key: string]: unknown;
}

export interface DesignNodeData extends BaseNodeData {
  htmlContent?: string;
  isPlaceholder?: boolean;
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
