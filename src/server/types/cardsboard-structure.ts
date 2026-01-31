/**
 * Type definitions for the .cardsboard folder structure
 * Includes: generated components, assets, and guides
 */

/**
 * AI-generated component metadata
 */
export interface GeneratedComponent {
  id: string;
  nodeId?: string;
  name: string;
  file: string;
  source: string;
  previewUrl?: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    prompt?: string;
    model?: string;
    variationOf?: string;
  };
}

/**
 * Registry of all generated components
 */
export interface GeneratedRegistry {
  components: GeneratedComponent[];
  variants: Record<string, GeneratedVariant[]>;
  lastUpdated: string;
}

/**
 * Generated component variant
 */
export interface GeneratedVariant {
  id: string;
  componentId: string;
  index: number;
  file: string;
  source: string;
  previewUrl?: string;
  createdAt: string;
}

/**
 * Uploaded image asset metadata
 */
export interface AssetImage {
  id: string;
  nodeId?: string;
  originalName: string;
  file: string;
  thumbnail?: string;
  mimeType: string;
  size: number;
  hash: string;
  createdAt: string;
}

/**
 * Registry of all assets
 */
export interface AssetRegistry {
  images: AssetImage[];
  lastUpdated: string;
}

/**
 * Color scheme definition
 */
export interface ColorScheme {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  text?: { primary?: string; secondary?: string };
  border?: string;
  palette?: Record<string, string>;
}

/**
 * Typography scheme definition
 */
export interface TypographyScheme {
  fontFamily?: Record<string, string>;
  fontSize?: Record<string, string>;
  fontWeight?: Record<string, string>;
}

/**
 * Spacing scheme definition
 */
export interface SpacingScheme {
  scale?: number;
  values?: Record<string, string>;
}

/**
 * Component pattern definitions
 */
export interface ComponentPatterns {
  button?: string;
  card?: string;
  input?: string;
  modal?: string;
  navigation?: string;
}

/**
 * Design system guide content
 */
export interface DesignSystemContent {
  vibe?: string;
  colors: ColorScheme;
  typography: TypographyScheme;
  spacing: SpacingScheme;
  borderRadius?: Record<string, string>;
  shadows?: Record<string, string>;
  patterns?: ComponentPatterns;
}

/**
 * Design system guide
 */
export interface DesignSystemGuide {
  id: string;
  name: string;
  file: string;
  content: DesignSystemContent;
  createdAt: string;
  updatedAt: string;
}

/**
 * Component catalog guide entry
 */
export interface ComponentCatalogEntry {
  name: string;
  filePath: string;
  props?: PropDefinition[];
  description?: string;
}

/**
 * Component prop definition
 */
export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

/**
 * Component catalog guide
 */
export interface ComponentCatalogGuide {
  id: string;
  name: string;
  file: string;
  components: ComponentCatalogEntry[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Registry of all guides
 */
export interface GuideRegistry {
  designSystems: DesignSystemGuide[];
  componentCatalogs: ComponentCatalogGuide[];
  lastUpdated: string;
}

/**
 * Complete .cardsboard folder structure
 */
export interface CardsboardStructure {
  canvasRegistry: {
    activeCanvasId: string | null;
    canvases: Array<{
      id: string;
      title: string;
      file: string;
      updatedAt: string;
    }>;
  };
  generated: GeneratedRegistry;
  assets: AssetRegistry;
  guides: GuideRegistry;
}

/**
 * Scanner cache entry
 */
export interface ScannerCacheEntry {
  name: string;
  filePath: string;
  relativePath: string;
  props?: PropDefinition[];
  isDefaultExport: boolean;
  lastModified: string;
}

/**
 * Scanner cache structure
 */
export interface ScannerCache {
  version: string;
  projectPath: string;
  components: ScannerCacheEntry[];
  lastScanned: string;
  scanPaths: string[];
}
