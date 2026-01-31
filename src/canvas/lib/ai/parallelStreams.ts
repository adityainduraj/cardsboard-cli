import { AIMessage, AICardContext } from "@/context/ai/AIContext";
import { AIModel } from "@/lib/openrouter/client";
import { Node } from "@xyflow/react";

interface StreamParams {
  messages: AIMessage[];
  contextCards: AICardContext[];
  model: AIModel;
  streamId: string;
  variationIndex?: number;
  totalVariations?: number;
  onChunk: (chunk: string) => void;
  onComplete: () => void;
}

async function fetchStream(params: StreamParams): Promise<void> {
  const response = await fetch("/api/ai/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: params.messages,
      contextCards: params.contextCards,
      model: params.model,
      variationIndex: params.variationIndex,
      totalVariations: params.totalVariations,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error("Stream failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    params.onChunk(decoder.decode(value, { stream: true }));
  }

  params.onComplete();
}

export interface ParallelStreamOptions {
  count: number;
  messages: AIMessage[];
  contextCards: AICardContext[];
  model: AIModel;
  sourceNodeId: string;
  positionStrategy: "around" | "below" | "horizontal";
  existingNodes: Node[];
  onStreamStart: (streamId: string, cardId: string, position: { x: number; y: number }) => void;
  onStreamChunk: (streamId: string, cardId: string, chunk: string) => void;
  onStreamComplete: (streamId: string, cardId: string) => void;
  onAllComplete: (cardIds: string[]) => void;
}

export async function executeParallelStreams(options: ParallelStreamOptions): Promise<void> {
  const { count, onStreamStart, onStreamChunk, onStreamComplete, onAllComplete, existingNodes } = options;

  const positions = calculateHorizontalPositions(count, existingNodes);

  const cards = Array.from({ length: count }, (_, i) => ({
    cardId: `ai-${Date.now()}-${i}`,
    streamId: `stream-${Date.now()}-${i}`,
    position: positions[i],
    variationIndex: i,
  }));

  const streamPromises = cards.map(async (card) => {
    const { streamId, cardId, variationIndex, position } = card;
    onStreamStart(streamId, cardId, position);

    await fetchStream({
      messages: options.messages,
      contextCards: options.contextCards,
      model: options.model,
      streamId,
      variationIndex,
      totalVariations: count,
      onChunk: (chunk) => onStreamChunk(streamId, cardId, chunk),
      onComplete: () => onStreamComplete(streamId, cardId),
    });
  });

  await Promise.all(streamPromises);
  onAllComplete(cards.map((c) => c.cardId));
}

function calculateHorizontalPositions(
  count: number,
  existingNodes: Node[]
): { x: number; y: number }[] {
  const CARD_WIDTH = 350;
  const CARD_HEIGHT = 300;
  const CARD_SPACING = 50;
  const PADDING = 100;

  let maxX = 0;
  let maxY = 0;
  let minY = Infinity;

  existingNodes.forEach((node) => {
    const nodeWidth = (node.measured?.width || node.width || 200) as number;
    const nodeHeight = (node.measured?.height || node.height || 150) as number;
    maxX = Math.max(maxX, node.position.x + nodeWidth);
    maxY = Math.max(maxY, node.position.y + nodeHeight);
    minY = Math.min(minY, node.position.y);
  });

  if (minY === Infinity) minY = 100;

  const startX = existingNodes.length > 0 ? maxX + PADDING : 100;
  const startY = minY;

  const positions: { x: number; y: number }[] = [];

  for (let i = 0; i < count; i++) {
    positions.push({
      x: startX + i * (CARD_WIDTH + CARD_SPACING),
      y: startY,
    });
  }

  return positions;
}
