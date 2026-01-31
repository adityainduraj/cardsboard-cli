import { getOpenRouter } from "@/lib/openrouter/client";
import type { DesignSystemNodeData, FetchedRepoFiles } from "@/types/design-system";

/**
 * Extract design system from fetched repository files using AI
 */
export async function extractDesignSystemFromFiles(
  files: FetchedRepoFiles,
  repoName?: string
): Promise<Partial<DesignSystemNodeData>> {
  const openrouter = getOpenRouter();

  // Build the prompt with file contents
  let prompt = `You are a design system extraction expert. Analyze the provided code files and extract the design system specification.\n\n`;

  if (files.tailwindConfig) {
    prompt += `=== tailwind.config ===\n${truncateFile(files.tailwindConfig, 3000)}\n\n`;
  }

  if (files.globalsCss) {
    prompt += `=== globals.css ===\n${truncateFile(files.globalsCss, 3000)}\n\n`;
  }

  if (files.packageJson) {
    prompt += `=== package.json (for context) ===\n${truncateFile(files.packageJson, 1000)}\n\n`;
  }

  // Add component examples (limit to avoid token limits)
  const componentEntries = Object.entries(files.components).slice(0, 5);
  if (componentEntries.length > 0) {
    prompt += `=== Component Examples ===\n`;
    for (const [name, content] of componentEntries) {
      prompt += `\n--- ${name} ---\n${truncateFile(content, 1500)}\n`;
    }
  }

  prompt += `\n${EXTRACTION_INSTRUCTIONS}`;

  try {
    const response = await openrouter.chat.completions.create({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "You are a design system extraction expert. Always return valid JSON only, no markdown formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const extracted = JSON.parse(content);

    // Transform AI response to DesignSystemNodeData format
    return {
      name: extracted.name || repoName || "Design System",
      source: "github" as const,
      colors: extracted.colors,
      typography: extracted.typography,
      spacing: extracted.spacing,
      borderRadius: extracted.borderRadius,
      shadows: extracted.shadows,
      patterns: extracted.patterns,
      vibeDescription: extracted.vibeDescription,
      rawFiles: {
        tailwindConfig: files.tailwindConfig,
        globalsCss: files.globalsCss,
        components: files.components,
      },
      extractedAt: Date.now(),
    };
  } catch (error) {
    console.error("Failed to extract design system:", error);
    throw new Error(`AI extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Extract design system from pasted code
 */
export async function extractDesignSystemFromCode(
  code: string,
  filename?: string
): Promise<Partial<DesignSystemNodeData>> {
  const openrouter = getOpenRouter();

  let prompt = `Extract the design system from the following code.\n\n`;

  if (filename) {
    prompt += `File: ${filename}\n`;
  }

  prompt += `=== Code ===\n${truncateFile(code, 8000)}\n\n`;
  prompt += EXTRACTION_INSTRUCTIONS;

  try {
    const response = await openrouter.chat.completions.create({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "You are a design system extraction expert. Always return valid JSON only, no markdown formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const extracted = JSON.parse(content);

    return {
      name: extracted.name || filename || "Design System",
      source: "code" as const,
      colors: extracted.colors,
      typography: extracted.typography,
      spacing: extracted.spacing,
      borderRadius: extracted.borderRadius,
      shadows: extracted.shadows,
      patterns: extracted.patterns,
      vibeDescription: extracted.vibeDescription,
      extractedAt: Date.now(),
    };
  } catch (error) {
    console.error("Failed to extract design system from code:", error);
    throw new Error(`AI extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Truncate file content to avoid exceeding token limits
 */
function truncateFile(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "\n... (truncated)";
}

/**
 * Instructions for AI extraction
 */
const EXTRACTION_INSTRUCTIONS = `
Based on the files above, extract and return a JSON object with this structure:

{
  "name": "Design System Name",
  "colors": {
    "primary": "#hex-value or CSS variable",
    "secondary": "#hex-value",
    "accent": "#hex-value",
    "background": "#hex-value",
    "surface": "#hex-value",
    "text": {
      "primary": "#hex-value",
      "secondary": "#hex-value"
    },
    "border": "#hex-value",
    "palette": {
      "color-name-1": "#hex",
      "color-name-2": "#hex"
    }
  },
  "typography": {
    "fontFamily": {
      "heading": "Font Name",
      "body": "Font Name",
      "mono": "Font Name"
    },
    "fontSize": {
      "xs": "12px",
      "sm": "14px",
      "base": "16px",
      "lg": "18px",
      "xl": "20px",
      "2xl": "24px",
      "3xl": "30px"
    },
    "fontWeight": {
      "normal": "400",
      "medium": "500",
      "semibold": "600",
      "bold": "700"
    }
  },
  "spacing": {
    "scale": 4,
    "values": {
      "1": "4px",
      "2": "8px",
      "4": "16px",
      "6": "24px",
      "8": "32px"
    }
  },
  "borderRadius": {
    "sm": "4px",
    "md": "8px",
    "lg": "12px",
    "xl": "16px",
    "full": "9999px"
  },
  "shadows": {
    "sm": "box-shadow definition",
    "md": "box-shadow definition",
    "lg": "box-shadow definition"
  },
  "patterns": {
    "button": "Typical button CSS classes or inline styles",
    "card": "Typical card CSS classes or inline styles",
    "input": "Typical input CSS classes or inline styles"
  },
  "vibeDescription": "Brief 1-2 sentence description of the design aesthetic (e.g., 'Minimal modern design with generous whitespace, rounded corners, and blue accent colors')"
}

GUIDELINES:
- Extract ACTUAL hex values, not class names like "bg-blue-600" → use "#2563eb"
- For Tailwind configs, include all colors in the palette
- For CSS variables, extract the computed hex values when possible
- Look at actual component usage to extract patterns
- Be thorough with color palettes - include all defined colors
- Describe the overall design aesthetic honestly and accurately in vibeDescription
- If a value is not found, omit it rather than guessing

Return ONLY valid JSON. No markdown formatting, no code blocks, just the JSON object.
`;
