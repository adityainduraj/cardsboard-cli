export interface DesignTokenColor {
    name: string;
    hex: string;
    originalName: string;
}

export interface DesignTokenTypography {
    name: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight?: number;
    letterSpacing?: number;
    sample: string;
}

export interface ParsedDesignSystem {
    colors: DesignTokenColor[];
    typography: DesignTokenTypography[];
    fonts: string[];
}

export function parseDesignTokensCSS(css: string): ParsedDesignSystem {
    const colors: DesignTokenColor[] = [];
    const typography: DesignTokenTypography[] = [];
    const fonts = new Set<string>();

    const classRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
    let match;

    while ((match = classRegex.exec(css)) !== null) {
        const className = match[1];
        const properties = match[2];

        const colorValue = extractColorValue(properties);
        const fontSize = extractFontSize(properties);
        const fontFamily = extractFontFamily(properties);
        const fontWeight = extractFontWeight(properties);
        const lineHeight = extractLineHeight(properties);
        const letterSpacing = extractLetterSpacing(properties);

        if (colorValue) {
            colors.push({
                name: sanitizeTokenName(className),
                hex: colorValue,
                originalName: className,
            });
        }

        if (fontSize && fontFamily) {
            const weightName = getWeightName(fontWeight);
            const sample = `${fontFamily} · ${fontSize}px · ${weightName}`;
            typography.push({
                name: sanitizeTokenName(className),
                fontFamily,
                fontSize,
                fontWeight,
                lineHeight,
                letterSpacing,
                sample,
            });
            fonts.add(fontFamily);
        }
    }

    return {
        colors,
        typography,
        fonts: Array.from(fonts),
    };
}

function extractColorValue(properties: string): string | null {
    const bgMatch = properties.match(/background:\s*([^;]+)/);
    if (bgMatch) {
        let value = bgMatch[1].trim();
        if (value.startsWith('#')) {
            return value;
        }
        if (value.startsWith('rgba') || value.startsWith('rgb')) {
            return rgbaToHex(value);
        }
        return value;
    }
    return null;
}

function extractFontSize(properties: string): number | null {
    const match = properties.match(/font-size:\s*(\d+(?:\.\d+)?)(px)?/);
    return match ? parseFloat(match[1]) : null;
}

function extractFontFamily(properties: string): string | null {
    const match = properties.match(/font-family:\s*([^;]+)/);
    if (match) {
        return match[1].trim().replace(/,\s*sans-serif$/, '').replace(/,\s*serif$/, '');
    }
    return null;
}

function extractFontWeight(properties: string): number {
    const match = properties.match(/font-weight:\s*(\d+)/);
    if (match) {
        return parseInt(match[1]);
    }
    const boldMatch = properties.match(/font-weight:\s*bold/i);
    return boldMatch ? 700 : 400;
}

function extractLineHeight(properties: string): number | undefined {
    const match = properties.match(/line-height:\s*(\d+(?:\.\d+)?)(px)?/);
    if (match) {
        return parseFloat(match[1]);
    }
    return undefined;
}

function extractLetterSpacing(properties: string): number | undefined {
    const match = properties.match(/letter-spacing:\s*(-?\d+(?:\.\d+)?)px?/);
    if (match) {
        return parseFloat(match[1]);
    }
    return undefined;
}

function rgbaToHex(rgba: string): string {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }
    return rgba;
}

function getWeightName(weight: number): string {
    if (weight >= 700) return "Bold";
    if (weight >= 600) return "SemiBold";
    if (weight >= 500) return "Medium";
    if (weight >= 300) return "Light";
    return "Regular";
}

function sanitizeTokenName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
