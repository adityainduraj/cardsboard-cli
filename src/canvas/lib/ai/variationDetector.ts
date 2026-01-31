export interface VariationIntent {
  isVariation: boolean;
  count: number;
  task: string;
}

export interface ImageIntent {
  isImageGeneration: boolean;
  isImageEdit: boolean;
  task: string;
}

export function detectVariationIntent(input: string): VariationIntent {
  const variationPatterns = [
    /(?:create|make|generate|write)\s+(\d+)?\s*(?:variations?|versions?|drafts?|options?)/i,
    /(?:give me\s+)?(\d+)?\s*(?:different\s+)?(?:ways?|options?|takes?)/i,
    /(?:create|make|write)\s+(\d+)?\s+(?:email|text|message)s?\s*(?:variations?|versions?|drafts?)?/i,
  ];

  for (const pattern of variationPatterns) {
    const match = input.match(pattern);
    if (match) {
      const count = match[1] ? parseInt(match[1]) : 3;
      return {
        isVariation: true,
        count: Math.min(count, 10),
        task: input,
      };
    }
  }

  return {
    isVariation: false,
    count: 1,
    task: input,
  };
}

export function detectImageIntent(input: string): ImageIntent {
  const imageEditPatterns = [
    /(?:change|edit|modify|update|fix|adjust|make).*?(?:background|color|style|size|position|add|remove|replace)/i,
    /(?:make|turn|set).*?(?:background|color).*?(?:white|black|blue|red|green|transparent)/i,
    /(?:remove|delete).*?(?:background|text|logo|watermark|element|object)/i,
    /(?:add|insert).*?(?:text|logo|icon|element|object|shape)/i,
    /change\s+(?:the\s+)?style\s+of/i,
    /replace\s+(?:the\s+)?(background|color|image)/i,
    /edit\s+(?:this\s+)?image/i,
    /update\s+(?:this\s+)?image/i,
  ];

  const imageGenPatterns = [
    /generate\s+(?:an?\s+)?image/i,
    /create\s+(?:an?\s+)?(?:image|picture|photo|graphic)/i,
    /make\s+(?:an?\s+)?(?:image|picture|photo)/i,
    /draw\s+(?:an?\s+)?/i,
  ];

  for (const pattern of imageEditPatterns) {
    if (pattern.test(input)) {
      return {
        isImageGeneration: false,
        isImageEdit: true,
        task: input,
      };
    }
  }

  for (const pattern of imageGenPatterns) {
    if (pattern.test(input)) {
      return {
        isImageGeneration: true,
        isImageEdit: false,
        task: input,
      };
    }
  }

  return {
    isImageGeneration: false,
    isImageEdit: false,
    task: input,
  };
}

export function isImageRequest(input: string): boolean {
  return detectImageIntent(input).isImageGeneration || detectImageIntent(input).isImageEdit;
}
