import { BaseNodeData } from "@/nodes/types";

/**
 * Design System color palette
 */
export interface DesignSystemColors {
  /** Primary brand color */
  primary?: string;
  /** Secondary brand color */
  secondary?: string;
  /** Accent color for highlights */
  accent?: string;
  /** Background color */
  background?: string;
  /** Surface/card background color */
  surface?: string;
  /** Text colors */
  text?: {
    primary?: string;
    secondary?: string;
    disabled?: string;
  };
  /** Border color */
  border?: string;
  /** Semantic colors */
  error?: string;
  success?: string;
  warning?: string;
  info?: string;
  /** Full color palette (name -> hex mapping) */
  palette?: Record<string, string>;
}

/**
 * Individual typography style definition
 */
export interface TypographyStyle {
  name?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
}

/**
 * Design System typography
 */
export interface DesignSystemTypography {
  /** Font families */
  fontFamily?: {
    heading?: string;
    body?: string;
    mono?: string;
  };
  /** Font sizes */
  fontSize?: Record<string, string>;
  /** Font weights */
  fontWeight?: Record<string, string>;
  /** Line heights */
  lineHeight?: Record<string, string>;
  /** Letter spacing */
  letterSpacing?: Record<string, string>;
  /** Heading style details */
  heading?: TypographyStyle;
  /** Body style details */
  body?: TypographyStyle;
}

/**
 * Design System spacing scale
 */
export interface DesignSystemSpacing {
  /** Base spacing unit (e.g., 4 for Tailwind) */
  scale?: number;
  /** Spacing values (name -> px mapping) */
  values?: Record<string, string>;
}

/**
 * Design System border radius
 */
export interface DesignSystemBorderRadius {
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  "2xl"?: string;
  full?: string;
}

/**
 * Design System shadows
 */
export interface DesignSystemShadows {
  xs?: string;
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
  "2xl"?: string;
  inner?: string;
}

/**
 * Component style patterns extracted from codebase
 */
export interface DesignSystemPatterns {
  /** Button component CSS classes/styles */
  button?: string;
  /** Card component CSS classes/styles */
  card?: string;
  /** Input component CSS classes/styles */
  input?: string;
  /** Modal component CSS classes/styles */
  modal?: string;
  /** Navigation component CSS classes/styles */
  navigation?: string;
}

/**
 * Raw files fetched from repository
 */
export interface DesignSystemRawFiles {
  tailwindConfig?: string;
  globalsCss?: string;
  packageJson?: string;
  components?: Record<string, string>;
}

/**
 * Design System node data
 * Stores extracted design system information from a codebase
 */
export interface DesignSystemNodeData extends BaseNodeData {
  /** Display name for this design system */
  name: string;
  /** Where this design system came from */
  source: "github" | "code" | "figma" | "manual";
  /** Source URL (GitHub repo URL or file reference) */
  sourceUrl?: string;
  /** Repository owner/name for GitHub sources */
  repoName?: string;

  // Extracted design tokens
  /** Color palette */
  colors?: DesignSystemColors;
  /** Typography settings */
  typography?: DesignSystemTypography;
  /** Spacing scale */
  spacing?: DesignSystemSpacing;
  /** Border radius values */
  borderRadius?: DesignSystemBorderRadius;
  /** Shadow definitions */
  shadows?: DesignSystemShadows;

  /** AI-extracted component patterns */
  patterns?: DesignSystemPatterns;

  /** Design "vibe" description for AI context */
  vibeDescription?: string;

  /** Raw fetched files for reference/debugging */
  rawFiles?: DesignSystemRawFiles;

  // UI state
  /** Currently extracting design system */
  isExtracting?: boolean;
  /** Extraction error message */
  extractionError?: string;
  /** When this was extracted */
  extractedAt?: number;
}

/**
 * Result from GitHub file fetcher
 */
export interface FetchedRepoFiles {
  tailwindConfig?: string;
  globalsCss?: string;
  packageJson?: string;
  components: Record<string, string>;
}

/**
 * Options for fetching from GitHub
 */
export interface GitHubFetcherOptions {
  repoUrl: string;
  branch?: string;
}

/**
 * Request to extract design system from GitHub
 */
export interface ExtractFromGitHubRequest {
  repoUrl: string;
  branch?: string;
}

/**
 * Request to extract design system from code
 */
export interface ExtractFromCodeRequest {
  code: string;
  filename?: string;
}
