import { AIMessage, AICardContext, GeneratedCard } from "@/context/ai/AIContext";
import { AIModel } from "@/lib/openrouter/client";
import { detectVariationIntent } from "./variationDetector";
import { executeParallelStreams } from "./parallelStreams";
import { Node } from "@xyflow/react";

interface VariationHandlerOptions {
  input: string;
  messages: AIMessage[];
  contextCards: AICardContext[];
  model: AIModel;
  sourceNodeId?: string;
  existingNodes: Node[];
  onCreatePendingCard: (card: GeneratedCard) => void;
  onUpdateCard: (cardId: string, updates: Partial<GeneratedCard>) => void;
  onCompleteCard: (cardId: string) => void;
  onConvertToNodes: () => void;
  onFitView: (nodeIds: string[]) => void;
}

export async function handleVariationRequest(options: VariationHandlerOptions): Promise<boolean> {
  const intent = detectVariationIntent(options.input);

  if (!intent.isVariation) {
    return false;
  }

  const pendingCardsMap = new Map<string, GeneratedCard>();

  await executeParallelStreams({
    count: intent.count,
    messages: options.messages,
    contextCards: options.contextCards,
    model: options.model,
    sourceNodeId: options.sourceNodeId || "",
    positionStrategy: "horizontal",
    existingNodes: options.existingNodes,
    onStreamStart: (_streamId, cardId, position) => {
      const card: GeneratedCard = {
        id: cardId,
        title: `Variation ${pendingCardsMap.size + 1}`,
        content: "",
        isComplete: false,
        sourceNodeId: options.sourceNodeId || "",
        position,
      };
      pendingCardsMap.set(cardId, card);
      options.onCreatePendingCard(card);
    },
    onStreamChunk: (_streamId, cardId, chunk) => {
      const card = pendingCardsMap.get(cardId);
      if (card) {
        card.content += chunk;
        options.onUpdateCard(cardId, { content: card.content });
      }
    },
    onStreamComplete: (_streamId, cardId) => {
      const card = pendingCardsMap.get(cardId);
      if (card) {
        card.isComplete = true;
        options.onCompleteCard(cardId);
      }
    },
    onAllComplete: (cardIds) => {
      setTimeout(() => {
        options.onConvertToNodes();
        options.onFitView(cardIds);
      }, 500);
    },
  });

  return true;
}

export function isVariationRequest(input: string): boolean {
  return detectVariationIntent(input).isVariation;
}
