
// Simplified Schema Definitions (The AI's DSL)
// Supports both old format (w, h) and new Pifani format (width, height)
export type AISketchShape = "rectangle" | "ellipse" | "diamond" | "arrow" | "line" | "text";

export interface AISketchElement {
    type: AISketchShape;
    text?: string;       // For text elements
    x: number;
    y: number;
    w?: number;          // Width (old format)
    h?: number;          // Height (old format)
    width?: number;      // Width (new format)
    height?: number;     // Height (new format)
    points?: [number, number][]; // For lines/arrows
    color?: string;      // Hex override (old format)
    strokeColor?: string; // Stroke color (new format)
    backgroundColor?: string; // Fill color (new format)
    style?: "solid" | "dashed" | "dotted";
    fontSize?: number;   // For text elements
    textAlign?: "left" | "center" | "right";
    label?: { text: string; strokeColor?: string }; // Button label (new format)
}

// Aesthetic defaults
const DEFAULT_STROKE_COLOR = "#1e1e1e";
const DEFAULT_BG_COLOR = "transparent";
const DEFAULT_ROUGHNESS = 0; // 0=architect (clean lines for wireframes)
const DEFAULT_STROKE_WIDTH = 1;

/**
 * Hydrates a simplified JSON array from the AI into full Excalidraw elements.
 * Supports both old sketch format and new Pifani wireframe format.
 */
export function hydrateSketchElements(aiElements: AISketchElement[]): any[] {
    const elements: any[] = [];

    for (const el of aiElements) {
        // Get dimensions (support both formats)
        const width = el.width ?? el.w ?? 100;
        const height = el.height ?? el.h ?? 100;

        // Get colors (support both formats)
        const strokeColor = el.strokeColor ?? el.color ?? DEFAULT_STROKE_COLOR;
        const backgroundColor = el.backgroundColor ?? DEFAULT_BG_COLOR;

        const base = {
            id: crypto.randomUUID(),
            x: el.x ?? 0,
            y: el.y ?? 0,
            strokeColor,
            backgroundColor,
            fillStyle: backgroundColor !== "transparent" && backgroundColor !== DEFAULT_BG_COLOR ? "solid" : "hachure",
            strokeWidth: DEFAULT_STROKE_WIDTH,
            strokeStyle: el.style || "solid",
            roughness: DEFAULT_ROUGHNESS,
            opacity: 100,
            groupIds: [],
            frameId: null,
            roundness: { type: 3 },
            seed: Math.floor(Math.random() * 100000),
            version: 1,
            versionNonce: Math.floor(Math.random() * 100000),
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
        };

        switch (el.type) {
            case "rectangle":
            case "ellipse":
            case "diamond":
                elements.push({
                    ...base,
                    type: el.type,
                    width,
                    height,
                    angle: 0,
                });

                // If element has a label (button text) or direct text property, add it as centered text
                const labelText = el.label?.text || el.text;
                if (labelText) {
                    const fontSize = el.fontSize || 20;
                    const estimatedTextWidth = labelText.length * (fontSize * 0.6);
                    const textX = (el.x ?? 0) + width / 2 - estimatedTextWidth / 2;
                    const textY = (el.y ?? 0) + height / 2 - fontSize / 2;

                    elements.push({
                        ...base,
                        id: crypto.randomUUID(),
                        type: "text",
                        x: textX,
                        y: textY,
                        text: labelText,
                        originalText: labelText,
                        fontSize,
                        fontFamily: 1, // Virgil
                        textAlign: "center",
                        verticalAlign: "middle",
                        baseline: 14,
                        width: estimatedTextWidth,
                        height: fontSize * 1.25,
                        angle: 0,
                        strokeColor: el.label?.strokeColor ?? el.color ?? el.strokeColor ?? DEFAULT_STROKE_COLOR,
                        backgroundColor: "transparent",
                    });
                }
                break;

            case "line":
                const linePoints = el.points || [[0, 0], [width, 0]];
                elements.push({
                    ...base,
                    type: "line",
                    width,
                    height,
                    angle: 0,
                    points: linePoints,
                });
                break;

            case "arrow":
                const arrowPoints = el.points || [[0, 0], [width, height]];
                elements.push({
                    ...base,
                    type: "arrow",
                    width,
                    height,
                    angle: 0,
                    points: arrowPoints,
                    startBinding: null,
                    endBinding: null,
                    startArrowhead: null,
                    endArrowhead: "arrow",
                });
                break;

            case "text":
                const fontSize = el.fontSize || 20;
                const textToMeasure = el.text || "Text";
                const estimatedWidth = textToMeasure.length * (fontSize * 0.6);

                elements.push({
                    ...base,
                    type: "text",
                    text: textToMeasure,
                    originalText: textToMeasure,
                    fontSize,
                    fontFamily: 1, // Virgil (hand-drawn)
                    textAlign: el.textAlign || "left",
                    verticalAlign: "top",
                    baseline: Math.round(fontSize * 0.9),
                    width: estimatedWidth,
                    height: fontSize * 1.25,
                    angle: 0,
                });
                break;

            default:
                // Fallback for unknowns
                elements.push({
                    ...base,
                    type: "rectangle",
                    width: 50,
                    height: 50,
                });
        }
    }

    return elements;
}
