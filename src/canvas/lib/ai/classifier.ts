import { AIModel } from "@/lib/openrouter/client";

/**
 * Card specification from classifier
 */
export interface CardSpec {
    title: string;
    suggestedWidth?: number;
    suggestedHeight?: number;
}

/**
 * Classification result from the AI classifier
 */
export interface ClassificationResult {
    type: QueryType;
    confidence: number;
    cardCount: number;                // How many cards will be created
    cards: CardSpec[];                // Titles and dimensions for each card
    targetCardIds?: string[];         // For edit requests
    modelRecommendation: AIModel;
    reasoning: string;                // Agent's thinking
    sectionTitle?: string;            // Title for the parent section container (optional, for variations)
    variationEntities?: string[];     // For variations: distinct entities (companies, people, etc.) to use, one per card
    rawDesignTokens?: string;         // For design_system_import: raw CSS/JSON tokens to parse
}

export type QueryType =
    | "text_generation"    // Create new text card(s)
    | "variation"          // Create multiple variations
    | "sketch"             // Create Excalidraw sketch/diagram
    | "wireframe"          // Create Excalidraw wireframe/mockup
    | "design"             // Create HTML/CSS design preview
    | "design_edit"        // Edit existing design in context
    | "design_system_context" // Use design system context for generation
    | "design_system_import" // Import design system from CSS/JSON tokens
    | "research"           // Search the web for information
    | "inspiration"        // Get design inspiration (like Mobbin)
    | "image_generation"   // Generate new image
    | "image_edit"         // Edit existing image
    | "card_edit"          // Edit existing text card
    | "question"           // Answer question (no card created)
    | "unknown";           // Unclear intent

/**
 * Context passed to classifier for better intent detection
 */
export interface ClassifierContext {
    query: string;
    hasContextCards: boolean;
    contextCardCount: number;
    contextCardTypes: ("text" | "image" | "sketch" | "design" | "designSystem" | "section")[];
    hasSelectedCards: boolean;
}

/**
 * Classify user query to determine intent and processing strategy
 */
export async function classifyQuery(context: ClassifierContext): Promise<ClassificationResult> {
    const response = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
    });

    if (!response.ok) {
        throw new Error("Classification failed");
    }

    return response.json();
}

/**
 * Fast local pre-classification using regex patterns
 * Returns a hint to help the LLM classifier
 */
export function getQueryHint(query: string): { likelyType: QueryType; patterns: string[] } {
    // Design system import patterns - CSS design tokens
    const cssDesignTokenPattern = /\.\w+\s*\{[\s\S]*?(?:background|font-size|font-family|color)[\s\S]*?\}/;
    if (cssDesignTokenPattern.test(query)) {
        return { likelyType: "design_system_import", patterns: ["design_system_import"] };
    }

    // Design system mention patterns (@design-system or @ds works anywhere in sentence)
    const designSystemPatterns = [
        /@design-system\b/i,
        /@designsystem\b/i,
        /@ds\b/i,
    ];

    for (const pattern of designSystemPatterns) {
        if (pattern.test(query)) {
            return { likelyType: "design_system_context", patterns: ["design_system"] };
        }
    }

    // Wireframe patterns - MUST be checked before design patterns
    // The word "wireframe" always indicates Excalidraw sketch, not HTML/CSS design
    const wireframePatterns = [
        /@wireframe\b/i,
        /\bwireframe\b/i,
        /\bmockup\b/i,
        /\blo-?fi\b/i,
        /\blow-?fidelity\b/i,
        /\bscreen\s+layout\b/i,
    ];

    for (const pattern of wireframePatterns) {
        if (pattern.test(query)) {
            return { likelyType: "wireframe", patterns: ["wireframe"] };
        }
    }

    // Design patterns - ONLY match if wireframe patterns didn't match
    const designPatterns = [
        /@design\b/i,
    ];

    for (const pattern of designPatterns) {
        if (pattern.test(query)) {
            return { likelyType: "design", patterns: ["design"] };
        }
    }

    // Variation patterns (@variants works anywhere in sentence)
    const variationPatterns = [
        /@variants?\b/i,
        /(\d+)\s*(variations?|versions?|drafts?|options?)/i,
        /give me\s*(\d+)?\s*(different|alternative)/i,
        /create\s*(\d+)\s*(email|text|message)/i,
    ];

    for (const pattern of variationPatterns) {
        if (pattern.test(query)) {
            return { likelyType: "variation", patterns: ["variation"] };
        }
    }

    // Inspiration patterns (@inspire or /inspire for design inspiration)
    const inspirationPatterns = [
        /@inspire\b/i,
        /^\/inspire\s/i,
    ];

    for (const pattern of inspirationPatterns) {
        if (pattern.test(query)) {
            return { likelyType: "inspiration", patterns: ["inspiration"] };
        }
    }

    // Image generation patterns
    const imageGenPatterns = [
        /generate\s+(an?\s+)?image/i,
        /create\s+(an?\s+)?image/i,
        /draw\s+/i,
        /make\s+(an?\s+)?(image|picture|photo)/i,
    ];

    for (const pattern of imageGenPatterns) {
        if (pattern.test(query)) {
            return { likelyType: "image_generation", patterns: ["image_generation"] };
        }
    }

    // Image edit patterns
    const imageEditPatterns = [
        /change\s+.*background/i,
        /edit\s+(this\s+)?image/i,
        /remove\s+.*from\s+(the\s+)?image/i,
    ];

    for (const pattern of imageEditPatterns) {
        if (pattern.test(query)) {
            return { likelyType: "image_edit", patterns: ["image_edit"] };
        }
    }

    // Question patterns
    const questionPatterns = [
        /^(what|how|why|when|where|who|which|can you|could you|would you)\s/i,
        /\?$/,
    ];

    for (const pattern of questionPatterns) {
        if (pattern.test(query)) {
            return { likelyType: "question", patterns: ["question"] };
        }
    }

    // Edit patterns (when context cards exist)
    const editPatterns = [
        /make\s+(it|this|the)/i,
        /change\s+(it|this|the)/i,
        /edit\s+(it|this|the)/i,
        /rewrite/i,
        /shorten/i,
        /expand/i,
        /improve/i,
    ];

    for (const pattern of editPatterns) {
        if (pattern.test(query)) {
            return { likelyType: "card_edit", patterns: ["card_edit"] };
        }
    }

    // Default to text generation
    return { likelyType: "text_generation", patterns: [] };
}
