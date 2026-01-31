import { useCallback, useRef } from "react";
import { AIMessage, AICardContext } from "@/context/ai/AIContext";
import { AIModel } from "@/lib/openrouter/client";

interface StreamOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export function useAIStream() {
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const createStream = useCallback(
    async (
      messages: AIMessage[],
      contextCards: AICardContext[],
      model: AIModel,
      streamId: string,
      options: StreamOptions
    ) => {
      const controller = new AbortController();
      abortControllers.current.set(streamId, controller);

      try {
        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, contextCards, model }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Stream failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          options.onChunk?.(chunk);
        }

        options.onComplete?.();
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          options.onError?.(error);
        }
      } finally {
        abortControllers.current.delete(streamId);
      }
    },
    []
  );

  const cancelStream = useCallback((streamId: string) => {
    const controller = abortControllers.current.get(streamId);
    controller?.abort();
    abortControllers.current.delete(streamId);
  }, []);

  const cancelAllStreams = useCallback(() => {
    abortControllers.current.forEach((controller) => controller.abort());
    abortControllers.current.clear();
  }, []);

  return { createStream, cancelStream, cancelAllStreams };
}
