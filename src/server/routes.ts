import { Express, Request } from "express";
import path from "path";
import fs from "fs";
import OpenAI from "openai";

// Import canvas management routes
import { setupCanvasRoutes } from "./routes/canvases";
import { setupCardsboardRoutes } from "./routes/cardsboard";
import { setupPreviewRoutes } from "./preview-server";

// Lazy initialization per request - each request can have a different API key
function getOpenRouterForRequest(req: Request): OpenAI {
  // Get API key from header (provided by client)
  const apiKey = req.headers["x-openrouter-api-key"] as string;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not provided. Please provide it via X-OpenRouter-API-Key header.");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://cardsboard.app",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Cardsboard",
    },
  });
}

interface AICardContext {
  id: string;
  title: string;
  content: string;
  type: "text" | "image" | "sketch" | "designSystem";
  nodeId: string;
  imageUrl?: string;
  elements?: any[];
  designSystem?: any;
}

interface DesignSystemNodeData {
  vibeDescription?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    surface?: string;
    text?: { primary?: string; secondary?: string };
    border?: string;
    palette?: Record<string, string>;
  };
  typography?: {
    fontFamily?: Record<string, string>;
    fontSize?: Record<string, string>;
    fontWeight?: Record<string, string>;
  };
  spacing?: {
    scale?: number;
    values?: Record<string, string>;
  };
  borderRadius?: Record<string, string>;
  shadows?: Record<string, string>;
  patterns?: {
    button?: string;
    card?: string;
    input?: string;
    modal?: string;
    navigation?: string;
  };
}

// System prompts for different intents
const SKETCH_SYSTEM_PROMPT = `You are an expert visual architect.
Your goal is to visualize the user's request using a simplified set of primitives.

OUTPUT FORMAT:
1. Briefly explain your design approach (1-2 sentences).
2. Output a JSON array wrapped in \`\`\`json\`\`\`.

PRIMITIVES (JSON Schema):
- type: "rectangle" | "ellipse" | "diamond" | "arrow" | "line" | "text"
- x, y: coordinates (start around 0,0)
- w, h: width/height
- text: (optional) label
- points: (optional) array of [x,y] for lines/arrows (relative to 0,0)
- style: (optional) "solid" | "dashed" | "dotted"
- color: (optional) hex string

EXAMPLE:
\`\`\`json
[
  { "type": "rectangle", "x": 0, "y": 0, "w": 200, "h": 100, "text": "Login" },
  { "type": "arrow", "x": 200, "y": 50, "points": [[0,0], [100,0]] },
  { "type": "ellipse", "x": 300, "y": 0, "w": 100, "h": 100, "text": "User" }
]
\`\`\`

IMPORTANT:
- Use "hand-drawn" logic (approximate positioning is fine).
- Keep it simple but descriptive.
- Ensure the JSON is valid.`;

const WIREFRAME_SYSTEM_PROMPT = `You are a senior UX designer at a top design studio. Create beautiful, professional wireframe sketches using Excalidraw elements.

OUTPUT: Valid JSON array only. No markdown, no explanations, no code blocks, NO COMMENTS.

═══════════════════════════════════════════════════════════
CANVAS & DIMENSIONS
═══════════════════════════════════════════════════════════

FOR MOBILE (380px wide):
- Canvas: 380px wide, ~800px tall
- Status bar area: y=0-24
- Nav bar: y=24, height=56
- Content: y=80 to y=700
- Bottom tab bar: y=720, height=80
- Touch targets: minimum 44x44px
- Margins: 16-20px from edges (x=16 or x=20)
- Element gaps: 12-16px between items

FOR DESKTOP (1280px wide):
- Canvas: 1280px wide, ~900px tall
- Top nav bar: y=0, height=64
- Sidebar (optional): x=0, width=240, height=900
- Main content: x=240 (if sidebar) or x=0, width=1040 or 1280
- Content area: y=64 to y=850
- NO bottom tab bar (desktop uses top nav)
- Margins: 32-48px from content edges
- Element gaps: 24-32px between items

═══════════════════════════════════════════════════════════
UI COMPONENT RECIPES
═══════════════════════════════════════════════════════════

▸ NAVIGATION BAR
  - Background: {"type": "rectangle", "x": 0, "y": 24, "width": 380, "height": 56, "backgroundColor": "#f5f5f5"}
  - Title: {"type": "text", "x": 190, "y": 42, "text": "Title", "fontSize": 18, "textAlign": "center"}

▸ SEARCH BAR
  - Container: {"type": "rectangle", "x": 16, "y": 90, "width": 348, "height": 44, "backgroundColor": "#f0f0f0"}
  - Placeholder: {"type": "text", "x": 60, "y": 102, "text": "Search...", "fontSize": 14}

▸ BUTTON (Primary - filled)
  {"type": "rectangle", "x": 16, "y": 500, "width": 348, "height": 52, "backgroundColor": "#333", "label": {"text": "Continue", "strokeColor": "#ffffff"}}

▸ LIST ITEM (horizontal layout!)
  - Avatar: {"type": "ellipse", "x": 20, "y": 400, "width": 48, "height": 48}
  - Title: {"type": "text", "x": 80, "y": 405, "text": "Item Title", "fontSize": 16}
  - Subtitle: {"type": "text", "x": 80, "y": 425, "text": "Description", "fontSize": 12}

▸ IMAGE PLACEHOLDER (NO diagonal lines!)
  - Just use a gray rectangle: {"type": "rectangle", "x": 16, "y": 100, "width": 348, "height": 200, "backgroundColor": "#e8e8e8"}

▸ BOTTOM TAB BAR (always include for mobile apps!)
  - Background: {"type": "rectangle", "x": 0, "y": 720, "width": 380, "height": 80, "backgroundColor": "#fafafa"}
  - Icon 1 (active): {"type": "ellipse", "x": 30, "y": 735, "width": 28, "height": 28, "backgroundColor": "#333"}

⚠️ CRITICAL: Output ONLY a valid JSON array.
- NO comments (// or /* */) - JSON does not support comments!
- NO markdown code blocks
- NO explanations before or after
- The first character must be '[' and the last must be ']'

Output ONLY the JSON array.`;

const DESIGN_SYSTEM_PROMPT = `You are a senior UI/UX designer and frontend engineer specializing in modern, responsive web applications.

IF AN IMAGE IS PROVIDED:
- Extract ONLY the software/UI elements from the image
- IGNORE any device frames (phones, tablets, laptops, monitors)
- IGNORE any bezels, notches, home indicators, or browser chrome
- Focus purely on the application/website UI content
- Recreate the design as a clean, standalone webpage

OUTPUT FORMAT:
Return ONLY complete, self-contained HTML with embedded CSS. No markdown, no explanations, no code blocks - just raw HTML starting with <!DOCTYPE html>.

CRITICAL REQUIREMENTS:

1. RESPONSIVE DESIGN (NON-NEGOTIABLE)
   - Use CSS Grid or Flexbox for ALL layouts
   - Include @media queries for mobile (max-width: 768px), tablet (max-width: 1024px), and desktop
   - Use relative units: %, fr, rem, em (avoid fixed pixels except for small values)
   - Ensure content flows naturally on different screen sizes

2. MODERN CSS ARCHITECTURE
   - Use CSS custom properties (variables) for colors, spacing, typography
   - Implement CSS Grid for complex layouts, Flexbox for alignment
   - Use clamp() for fluid typography
   - Include min-height: 100vh and viewport meta tag

3. VISUAL EXCELLENCE
   - Sophisticated color palette with CSS variables
   - Subtle shadows: 0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)
   - border-radius: 8px for cards, 12px for large containers
   - Smooth transitions: transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)
   - Proper contrast ratios for accessibility (WCAG AA minimum)

4. INTERACTIVE STATES
   - Hover states for all interactive elements
   - Focus states with visible outline
   - Active/pressed states
   - Disabled state styling

5. CLEAN HTML STRUCTURE
   - Semantic elements: header, main, nav, section, article, footer
   - Proper heading hierarchy (h1 → h2 → h3)

6. TYPEFACE & SPACING
   - Use the specific font family from the DESIGN SYSTEM if provided.
   - If a font is provided as a URL, include it using @import or <link> and then use the descriptive font name for the font-family property.
   - DO NOT use font URLs directly as font-family names.
   - Fallback to: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
   - Consistent spacing scale (4px, 8px, 12px, 16px, 24px, 32px, 48px)
   - Line height: 1.5 for body, 1.2 for headings

DO NOT:
- Include markdown formatting or code blocks
- Add explanations before/after the HTML
- Use fixed pixel widths for main containers
- Forget media queries
- Use placeholder images (use CSS gradients/patterns)
- Include device frames or hardware elements

START DIRECTLY WITH <!DOCTYPE html>.`;

/**
 * Build design system guidance for AI prompts
 */
function buildDesignSystemPrompt(designSystem: DesignSystemNodeData): string {
  let prompt = "\n==== DESIGN SYSTEM TO FOLLOW ====\n";

  if (designSystem.vibeDescription) {
    prompt += `STYLE: ${designSystem.vibeDescription}\n\n`;
  }

  if (designSystem.colors) {
    prompt += "COLORS:\n";
    if (designSystem.colors.primary) prompt += `  Primary: ${designSystem.colors.primary}\n`;
    if (designSystem.colors.secondary) prompt += `  Secondary: ${designSystem.colors.secondary}\n`;
    if (designSystem.colors.accent) prompt += `  Accent: ${designSystem.colors.accent}\n`;
    if (designSystem.colors.background) prompt += `  Background: ${designSystem.colors.background}\n`;
    if (designSystem.colors.surface) prompt += `  Surface: ${designSystem.colors.surface}\n`;
    if (designSystem.colors.text?.primary) prompt += `  Text Primary: ${designSystem.colors.text.primary}\n`;
    if (designSystem.colors.text?.secondary) prompt += `  Text Secondary: ${designSystem.colors.text.secondary}\n`;
    if (designSystem.colors.border) prompt += `  Border: ${designSystem.colors.border}\n`;
    if (designSystem.colors.palette && Object.keys(designSystem.colors.palette).length > 0) {
      prompt += `  Full Palette: ${JSON.stringify(designSystem.colors.palette)}\n`;
    }
    prompt += "\n";
  }

  if (designSystem.typography) {
    prompt += "TYPOGRAPHY:\n";
    if (designSystem.typography.fontFamily) {
      prompt += `  Font Families: ${JSON.stringify(designSystem.typography.fontFamily)}\n`;
    }
    if (designSystem.typography.fontSize) {
      prompt += `  Font Sizes: ${JSON.stringify(designSystem.typography.fontSize)}\n`;
    }
    if (designSystem.typography.fontWeight) {
      prompt += `  Font Weights: ${JSON.stringify(designSystem.typography.fontWeight)}\n`;
    }
    prompt += "\n";
  }

  if (designSystem.spacing) {
    prompt += `SPACING: Scale ${designSystem.spacing.scale || 4}`;
    if (designSystem.spacing.values) {
      prompt += `, values: ${JSON.stringify(designSystem.spacing.values)}`;
    }
    prompt += "\n\n";
  }

  if (designSystem.borderRadius) {
    prompt += `BORDER RADIUS: ${JSON.stringify(designSystem.borderRadius)}\n\n`;
  }

  if (designSystem.shadows) {
    prompt += `SHADOWS: ${JSON.stringify(designSystem.shadows)}\n\n`;
  }

  if (designSystem.patterns) {
    prompt += "COMPONENT PATTERNS:\n";
    if (designSystem.patterns.button) prompt += `  Button: ${designSystem.patterns.button}\n`;
    if (designSystem.patterns.card) prompt += `  Card: ${designSystem.patterns.card}\n`;
    if (designSystem.patterns.input) prompt += `  Input: ${designSystem.patterns.input}\n`;
    if (designSystem.patterns.modal) prompt += `  Modal: ${designSystem.patterns.modal}\n`;
    if (designSystem.patterns.navigation) prompt += `  Navigation: ${designSystem.patterns.navigation}\n`;
    prompt += "\n";
  }

  prompt += "CRITICAL: When generating HTML/CSS designs, you MUST use these exact values.\n";
  prompt += "Match the colors, typography, spacing, and component patterns shown above.\n";
  prompt += "==============================\n\n";

  return prompt;
}

// Helper to summarize wireframe elements for context
function summarizeWireframeElements(elements: any[]): string {
  if (!elements || elements.length === 0) return "Empty wireframe";

  const summary: string[] = [];
  const componentCounts: Record<string, number> = {};
  const textLabels: string[] = [];

  for (const el of elements) {
    const type = el.type || "unknown";
    componentCounts[type] = (componentCounts[type] || 0) + 1;

    // Collect text content for context
    if (type === "text" && el.text) {
      textLabels.push(el.text);
    }
  }

  // Summarize component types
  const componentSummary = Object.entries(componentCounts)
    .map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`)
    .join(", ");

  summary.push(`Components: ${componentSummary}`);

  // Include key text labels (limit to avoid overwhelming context)
  if (textLabels.length > 0) {
    const keyLabels = textLabels.slice(0, 10).join(", ");
    summary.push(`Text labels: ${keyLabels}${textLabels.length > 10 ? "..." : ""}`);
  }

  return summary.join("\n");
}

let availableComponents: any[] = [];

function buildSystemPrompt(
  contextCards: AICardContext[],
  variationIndex?: number,
  totalVariations?: number,
  intent?: string,
  variationEntity?: string,
  designSystemContext?: DesignSystemNodeData
): string {
  let prompt = "";

  // Add intent-specific system prompts
  if (intent === "sketch") {
    prompt += SKETCH_SYSTEM_PROMPT + "\n\n";
  } else if (intent === "wireframe") {
    prompt += WIREFRAME_SYSTEM_PROMPT + "\n\n";
  } else if (intent === "design") {
    prompt += DESIGN_SYSTEM_PROMPT + "\n\n";

    // Add available components from scanning
    if (availableComponents.length > 0) {
      prompt += "AVAILABLE REPOSITORY COMPONENTS (Use these names in your design):\n";
      prompt += availableComponents.map(c => `- ${c.name} (from ${c.relativePath})`).join("\n");
      prompt += "\n\nIMPORTANT: When generating designs, assume these components are available. Mention them in comments or use their names for CSS classes.\n\n";
    }
  }

  // Inject design system guidance if provided
  if (designSystemContext) {
    prompt += buildDesignSystemPrompt(designSystemContext);
  }

  // Add variation-specific instructions
  if (variationIndex !== undefined && totalVariations !== undefined) {
    prompt += `CRITICAL INSTRUCTION: You are generating variation ${variationIndex + 1} of ${totalVariations} total variations.

RULES YOU MUST FOLLOW:
1. Generate EXACTLY ONE complete response - not multiple drafts or options
2. Do NOT number your response (no "Draft 1", "Option A", etc.)
3. Do NOT include multiple versions in your response
4. Write as if this is the ONLY version you are creating
5. Make this variation unique by using a different tone, angle, or approach${variationEntity ? `\n6. FOCUS SPECIFICALLY ON: ${variationEntity}. This variation must be about ${variationEntity} and should NOT repeat content from other variations.` : ""}

Your response should be a single, complete piece of content. Begin immediately with the content itself.

`;
  }

  if (contextCards.length === 0) {
    return prompt + "You are a helpful creative assistant. Fulfill the user's request directly and completely. If the user asks for long-form content, provide it. Do not refuse requests for length.";
  }

  return prompt + `You are a card assistant. ${contextCards.length} card(s) are provided as context:

${contextCards.map((c, i) => {
    if (c.type === "image") {
      return `[Card ${i + 1}] ${c.title || "Untitled"} (Image): [Image data provided separately]`;
    }
    // Handle sketch/wireframe context - describe the UI elements instead of raw JSON
    if (c.type === "sketch" && c.elements && Array.isArray(c.elements)) {
      const elementSummary = summarizeWireframeElements(c.elements);
      return `[Card ${i + 1}] ${c.title || "Wireframe"} (Wireframe/Sketch):\n${elementSummary}`;
    }
    return `[Card ${i + 1}] ${c.title || "Untitled"}:\n${c.content}`;
  }).join("\n\n")}

When generating a new wireframe based on an existing one:
- Maintain visual consistency (same spacing, sizing conventions)
- Use similar component patterns (same button styles, input styles, etc.)
- Create a screen that logically follows from or relates to the reference wireframe

Provide helpful, complete responses based on this context. Do not arbitrarily limit response length unless asked.`;
}

export function setupRoutes(
  app: Express,
  components: any[],
  projectPath: string,
  _config: any
) {
  availableComponents = components;

  // Setup canvas management routes (multi-canvas support)
  setupCanvasRoutes(app, projectPath);

  // Setup .cardsboard folder structure routes (generated, assets, guides)
  setupCardsboardRoutes(app);

  // Setup preview server routes for React component rendering
  setupPreviewRoutes(app);

  // API: Get all discovered components
  app.get("/api/components", (_req, res) => {
    res.json(components);
  });

  // API: Get component source code
  app.get("/api/component/:name", (req, res) => {
    const component = components.find((c) => c.name === req.params.name);
    if (!component) {
      res.status(404).json({ error: "Component not found" });
      return;
    }

    try {
      const source = fs.readFileSync(component.filePath, "utf-8");
      res.json({ ...component, source });
    } catch (e) {
      res.status(500).json({ error: "Failed to read component file" });
    }
  });

  // API: Get design system (tailwind config, globals.css)
  app.get("/api/design-system", (_req, res) => {
    const designSystem: any = {};

    // Try to find tailwind config
    const tailwindPaths = [
      "tailwind.config.ts",
      "tailwind.config.js",
      "tailwind.config.mjs",
    ];

    for (const tailwindPath of tailwindPaths) {
      const fullPath = path.join(projectPath, tailwindPath);
      if (fs.existsSync(fullPath)) {
        try {
          designSystem.tailwindConfig = fs.readFileSync(fullPath, "utf-8");
          break;
        } catch (e) {
          console.warn(`Failed to read ${tailwindPath}`);
        }
      }
    }

    // Try to find globals.css or similar
    const cssPaths = [
      "app/globals.css",
      "src/app/globals.css",
      "styles/globals.css",
      "src/styles/globals.css",
      "globals.css",
    ];

    for (const cssPath of cssPaths) {
      const fullPath = path.join(projectPath, cssPath);
      if (fs.existsSync(fullPath)) {
        try {
          designSystem.globalsCSS = fs.readFileSync(fullPath, "utf-8");
          break;
        } catch (e) {
          console.warn(`Failed to read ${cssPath}`);
        }
      }
    }

    res.json(designSystem);
  });

  // API: AI classify endpoint
  app.post("/api/ai/classify", async (req, res) => {
    try {
      const { query, hasContextCards, contextCardCount, contextCardTypes, hasSelectedCards } = req.body;

      const CLASSIFIER_PROMPT = `You are a query classifier for a canvas-based AI assistant. Your job is to analyze the user's query and determine their intent, how many cards to create, and suggest titles.

CLASSIFICATION TYPES:
- "text_generation": User wants to create new text content (emails, descriptions, copy, etc.)
- "variation": User wants multiple versions/variations of something
- "image_generation": User wants to generate/create a single new image
- "card_edit": User wants to modify existing text content (and has text cards in context)
- "sketch": User wants a visual diagram, flowchart, or drawing
- "wireframe": User wants a UI wireframe or mockup
- "design": User wants to create a fully rendered HTML/CSS UI design
- "question": User is asking a question or seeking information (no card creation needed)
- "unknown": Cannot determine intent

RESPONSE FORMAT (JSON only, no markdown):
{
  "type": "<classification_type>",
  "confidence": <0.0-1.0>,
  "cardCount": <number of cards to create, 0 for questions>,
  "cards": [
    {
      "title": "<descriptive title for this card>",
      "suggestedWidth": <width in pixels>,
      "suggestedHeight": <height in pixels>
    }
  ],
  "sectionTitle": "<title for the section container if variations>",
  "modelRecommendation": "<model_id>",
  "reasoning": "<brief explanation>"
}

MODEL RECOMMENDATIONS:
- For text: "google/gemini-2.5-flash"
- For variations: "google/gemini-2.5-flash"
- For image generation: "google/gemini-2.5-flash-image"
- For design: "google/gemini-2.5-flash"
- For questions: "google/gemini-2.5-flash"

IMPORTANT:
- Always provide meaningful, descriptive titles (not "Card 1", "Card 2")
- For questions, cardCount should be 0
- Be concise in reasoning (1 sentence max)`;

      const userMessage = `Query: "${query}"

Context:
- Has context cards: ${hasContextCards}
- Context card count: ${contextCardCount}
- Context card types: ${contextCardTypes?.join(", ") || "none"}
- Has selected cards: ${hasSelectedCards}

Classify this query and determine card specifications.`;

      const openrouter = getOpenRouterForRequest(req);
      const completion = await openrouter.chat.completions.create({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: CLASSIFIER_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 500,
      });

      const responseText = completion.choices[0]?.message?.content || "";

      // Parse JSON from response (handle markdown code blocks if present)
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const result = JSON.parse(jsonStr.trim());

      // Ensure cards array exists and has defaults
      const cards = (result.cards || []).map((card: { title?: string; suggestedWidth?: number; suggestedHeight?: number }, index: number) => ({
        title: card.title || `Card ${index + 1}`,
        suggestedWidth: card.suggestedWidth || 450,
        suggestedHeight: card.suggestedHeight || 350,
      }));

      // For variations, ensure we have the right number of cards
      if (result.type === "variation" && result.cardCount > cards.length) {
        for (let i = cards.length; i < result.cardCount; i++) {
          cards.push({
            title: `Variation ${i + 1}`,
            suggestedWidth: 450,
            suggestedHeight: 350,
          });
        }
      }

      // For single text generation, ensure at least one card
      if (result.type === "text_generation" && cards.length === 0) {
        cards.push({
          title: "AI Response",
          suggestedWidth: 450,
          suggestedHeight: 350,
        });
      }

      // MODEL NORMALIZATION: Catch the old invalid model ID if AI hallucinates it
      let modelRec = result.modelRecommendation || "google/gemini-2.5-flash";
      if (modelRec === "google/gemini-2.5-flash-preview-05-20") {
        modelRec = "google/gemini-2.5-flash-image";
      }

      const response = {
        type: result.type || "unknown",
        confidence: result.confidence || 0.5,
        cardCount: result.cardCount ?? cards.length,
        cards,
        targetCardIds: null,
        modelRecommendation: modelRec,
        reasoning: result.reasoning || "Classification complete",
        sectionTitle: result.type === "variation" ? (result.sectionTitle || "Variations") : undefined,
        variationEntities: result.variationEntities || undefined,
      };

      res.json(response);
    } catch (error) {
      console.error("Classification error:", error);

      // Return a safe fallback
      res.json({
        type: "text_generation",
        confidence: 0.3,
        cardCount: 1,
        cards: [{ title: "AI Response", suggestedWidth: 450, suggestedHeight: 350 }],
        targetCardIds: null,
        modelRecommendation: "google/gemini-2.5-flash",
        reasoning: "Fallback classification due to error",
      });
    }
  });

  // API: AI streaming endpoint
  app.post("/api/ai/stream", async (req, res) => {
    try {
      const {
        messages,
        contextCards = [],
        model = "google/gemini-2.5-flash",
        variationIndex,
        totalVariations,
        intent,
        variationEntity,
        designSystemContext
      } = req.body;

      const systemPrompt = buildSystemPrompt(
        contextCards,
        variationIndex,
        totalVariations,
        intent,
        variationEntity,
        designSystemContext
      );

      // Build messages with image context if present (include sketches and designs if they have previews)
      const imageContextCards = contextCards.filter((c: any) => c.imageUrl);

      let messagesWithSystem: any[];

      if (imageContextCards.length > 0) {
        // Build multimodal messages
        const processedMessages = messages.map((msg: any) => {
          if (msg.role === "user") {
            const contentParts: any[] = [];

            if (msg.content) {
              if (typeof msg.content === "string") {
                contentParts.push({ type: "text", text: msg.content });
              } else if (Array.isArray(msg.content)) {
                contentParts.push(...msg.content);
              }
            }

            // Add all images from context
            imageContextCards.forEach((card: any) => {
              if (card.imageUrl) {
                contentParts.push({
                  type: "image_url",
                  image_url: { url: card.imageUrl }
                });
              }
            });

            return {
              ...msg,
              content: contentParts.length > 0 ? contentParts : msg.content
            };
          }
          return msg;
        });

        messagesWithSystem = [
          { role: "system", content: systemPrompt },
          ...processedMessages,
        ];
      } else {
        messagesWithSystem = [
          { role: "system", content: systemPrompt },
          ...messages,
        ];
      }

      const openrouter = getOpenRouterForRequest(req);
      const completion = await openrouter.chat.completions.create({
        model,
        messages: messagesWithSystem,
        stream: true,
      });

      // Set up streaming response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(content);
        }
      }

      res.end();
    } catch (error) {
      console.error("AI streaming error:", error);
      res.status(500).json({
        error: "AI request failed",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // API: Image generation endpoint
  app.post("/api/ai/generate-image", async (req, res) => {
    try {
      const { prompt, model, contextCards = [] } = req.body;

      if (!prompt) {
        res.status(400).json({ error: "Prompt is required" });
        return;
      }

      // Use the model from classification, or default to gemini image model
      let imageModel = model || "google/gemini-2.5-flash-image";

      // Force normalization here too
      if (imageModel === "google/gemini-2.5-flash-preview-05-20") {
        imageModel = "google/gemini-2.5-flash-image";
      }

      console.log("Generating image for prompt:", prompt, "using model:", imageModel);

      // Detect if this is a UI/app/screen mockup request
      const uiKeywords = /\b(app|application|ui|interface|screen|mobile|iphone|android|webpage|website|landing page|dashboard|settings|profile|login|signup|home screen)\b/i;
      const isUIRequest = uiKeywords.test(prompt);

      // Build system prompt based on request type
      const systemPrompt = isUIRequest
        ? `You are a UI design specialist. When generating UI mockups:
- Create ONLY the digital interface/software UI elements
- DO NOT include any physical device frames (no phones, tablets, laptops, monitors)
- DO NOT include hardware elements (no buttons, home indicators, notches, device frames)
- DO NOT show the UI on a physical device or in a real-world setting
- Output a clean, flat UI design as if viewing it directly on screen
- The result should be a pure digital UI mockup with no physical context`
        : `You are an image generation model. When the user requests an image, generate and return ONLY the image data in base64 format. Do not include any text descriptions or explanations.`;

      // Build user message with images if context has images
      const imageContextCards = (contextCards as AICardContext[]).filter(c => c.type === "image" && c.imageUrl);

      const userContent = imageContextCards.length > 0
        ? [
          { type: "text", text: isUIRequest ? `UI Design Request: ${prompt}\n\nGenerate a clean digital UI mockup with NO physical device frames.` : prompt },
          ...imageContextCards
            .filter((card) => card.imageUrl)
            .map((card) => ({
              type: "image_url" as const,
              image_url: { url: card.imageUrl as string }
            }))
        ]
        : isUIRequest
          ? `UI Design Request: ${prompt}\n\nGenerate a clean digital UI mockup with NO physical device frames.`
          : prompt;

      const openrouter = getOpenRouterForRequest(req);
      const response = await openrouter.chat.completions.create({
        model: imageModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        // @ts-ignore - modalities might not be typed in SDK
        modalities: ["image"],
        temperature: 0.7,
      });

      const message = response.choices[0]?.message;

      if (!message) {
        throw new Error("No message received from image generation");
      }

      console.log("Image generation response structure:", {
        // @ts-ignore
        hasImages: !!message.images,
        // @ts-ignore
        imagesLength: message.images?.length,
        hasContent: !!message.content,
        contentType: typeof message.content,
        isArray: Array.isArray(message.content),
      });

      let imageUrl = "";

      // PRIMARY: Check message.images array (OpenRouter format)
      // @ts-ignore
      if (message.images && Array.isArray(message.images) && message.images.length > 0) {
        // @ts-ignore
        const firstImage = message.images[0];
        // @ts-ignore
        if (firstImage.image_url?.url) {
          // @ts-ignore
          imageUrl = firstImage.image_url.url;
        }
      }

      // FALLBACK: Check if content is an array (multimodal response)
      if (!imageUrl && Array.isArray(message.content)) {
        for (const part of message.content) {
          // @ts-ignore
          if (part.type === "image_url" && part.image_url?.url) {
            // @ts-ignore
            imageUrl = part.image_url.url;
            break;
          }
          // @ts-ignore
          if (part.type === "image" && part.image_url?.url) {
            // @ts-ignore
            imageUrl = part.image_url.url;
            break;
          }
          // @ts-ignore
          if (part.type === "image" && part.data) {
            // @ts-ignore
            imageUrl = part.data;
            break;
          }
          // @ts-ignore
          if (part.inline_data) {
            // @ts-ignore
            const mimeType = part.inline_data.mime_type || "image/png";
            // @ts-ignore
            imageUrl = `data:${mimeType};base64,${part.inline_data.data}`;
            break;
          }
        }
      }

      // Check if content is a string with data URL
      if (!imageUrl && typeof message.content === "string") {
        const content = message.content;
        if (content.startsWith("data:image")) {
          imageUrl = content;
        } else {
          // Try to extract from markdown image syntax
          const markdownMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
          if (markdownMatch) {
            imageUrl = markdownMatch[1];
          } else {
            // Try to find data URL anywhere in the content
            const dataUrlMatch = content.match(/(data:image\/[^;]+;base64,[^\s"')]+)/);
            if (dataUrlMatch) {
              imageUrl = dataUrlMatch[1];
            }
          }
        }
      }

      // Check if message has parts (for Gemini native format)
      // @ts-ignore
      if (!imageUrl && message.parts) {
        // @ts-ignore
        for (const part of message.parts) {
          // @ts-ignore
          if (part.type === "image" || part.inline_data) {
            // @ts-ignore
            if (part.inline_data?.data) {
              // @ts-ignore
              const mimeType = part.inline_data.mime_type || "image/png";
              // @ts-ignore
              imageUrl = `data:${mimeType};base64,${part.inline_data.data}`;
              break;
            }
            // @ts-ignore
            if (part.data) {
              // @ts-ignore
              imageUrl = part.data;
              break;
            }
          }
        }
      }

      if (!imageUrl) {
        console.error("Image generation response:", JSON.stringify(message, null, 2));
        const contentStr = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
        if (contentStr && !contentStr.includes("data:image")) {
          throw new Error(`API returned text instead of image: ${contentStr.substring(0, 200)}`);
        }
        throw new Error("Could not extract image URL from response");
      }

      // Validate that we actually have an image URL
      if (!imageUrl.startsWith("data:image") && !imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
        throw new Error(`Invalid image URL format: ${imageUrl.substring(0, 100)}`);
      }

      res.json({ imageUrl });
    } catch (error) {
      console.error("Image generation error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      res.status(500).json({
        error: "Failed to generate image",
        details: errorMessage,
      });
    }
  });

  // API: Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      components: components.length,
    });
  });

  // API: Canvas persistence
  const canvasFilePath = path.join(projectPath, ".cardsboard", "canvas.json");

  app.get("/api/canvas", (_req, res) => {
    try {
      if (fs.existsSync(canvasFilePath)) {
        const data = JSON.parse(fs.readFileSync(canvasFilePath, "utf-8"));
        res.json(data);
      } else {
        res.json({ nodes: [], edges: [], title: "My Canvas" });
      }
    } catch (e) {
      res.status(500).json({ error: "Failed to load canvas" });
    }
  });

  app.post("/api/canvas", (req, res) => {
    try {
      const canvasDir = path.join(projectPath, ".cardsboard");
      if (!fs.existsSync(canvasDir)) {
        fs.mkdirSync(canvasDir, { recursive: true });
      }

      const data = {
        ...req.body,
        updated_at: new Date().toISOString(),
      };

      fs.writeFileSync(canvasFilePath, JSON.stringify(data, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save canvas" });
    }
  });

  // API: Save active canvas (multi-canvas system)
  app.post("/api/canvas/active", (req, res) => {
    try {
      const { id, nodes, edges } = req.body;

      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Canvas ID is required" });
      }

      // Find the canvas file in registry
      const registry = JSON.parse(fs.readFileSync(
        path.join(projectPath, ".cardsboard", "canvases.json"),
        "utf-8"
      ));

      const canvasEntry = registry.canvases.find((c: any) => c.id === id);

      if (!canvasEntry) {
        return res.status(404).json({ error: "Canvas not found" });
      }

      const canvasPath = path.join(projectPath, ".cardsboard", "canvases", canvasEntry.file);
      const content = fs.readFileSync(canvasPath, "utf-8");
      const canvas: any = JSON.parse(content);

      // Update canvas data
      if (nodes !== undefined) canvas.nodes = nodes;
      if (edges !== undefined) canvas.edges = edges;
      canvas.updatedAt = new Date().toISOString();

      // Write updated canvas
      fs.writeFileSync(canvasPath, JSON.stringify(canvas, null, 2));

      // Update registry timestamp
      canvasEntry.updatedAt = canvas.updatedAt;
      fs.writeFileSync(
        path.join(projectPath, ".cardsboard", "canvases.json"),
        JSON.stringify(registry, null, 2)
      );

      return res.json({ success: true, canvas });
    } catch (e) {
      console.error("Failed to save active canvas:", e);
      return res.status(500).json({ error: "Failed to save active canvas" });
    }
  });

  // Serve sketch editor page - handles both dev (src) and prod (dist) layouts
  app.get("/sketch-editor", (_req, res) => {
    // 1. Check relative to current directory (works in dist/ if canvas is subfolder)
    const prodPath = path.join(__dirname, "canvas/sketch-editor.html");
    // 2. Check up one level (works in dist/ if server.js is in dist/server/)
    const prodPath2 = path.join(__dirname, "../canvas/sketch-editor.html");
    // 3. Check src path for development
    const devPath = path.join(process.cwd(), "src/canvas/sketch-editor.html");

    if (fs.existsSync(prodPath)) {
      res.sendFile(prodPath);
    } else if (fs.existsSync(prodPath2)) {
      res.sendFile(prodPath2);
    } else if (fs.existsSync(devPath)) {
      res.sendFile(devPath);
    } else {
      console.warn("Sketch editor not found in expected locations:", { prodPath, prodPath2, devPath });
      res.status(404).send("Sketch editor not found");
    }
  });
}
