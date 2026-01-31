"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  CursorIcon,
  TextIcon,
  MicIcon,
  ColorIcon,
  AISparklesIcon,
  ShareIcon,
} from "@/components/ui/icons/BottomBarIcons";
import { ArrowRightIcon } from "@/components/ui/icons/ArrowRightIcon";
import { useAIContext } from "@/context/ai/AIContext";
import { ContextPreviewCard } from "./ContextPreviewCard";
import { classifyQuery } from "@/lib/ai/classifier";
import { calculateCardPosition, calculateVariationPositions } from "@/lib/ai/positioning";
import type { DesignSystemNodeData } from "@/types/design-system";

type ToolType = "select" | "text" | "audio" | "colors" | "ai" | "share";

interface ToolButtonProps {
  tool: ToolType;
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  visible: boolean;
}

function ToolButton({ selected, onClick, icon, visible }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        border: "none",
        backgroundColor: selected ? "#EFEFEF" : "transparent",
        cursor: "pointer",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.8)",
        transition: "opacity 0.2s ease-out, transform 0.2s ease-out, background-color 0.15s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = "#F5F5F5";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      {icon}
    </button>
  );
}

const LINE_HEIGHT = 20;
const MAX_LINES = 4;
const DEFAULT_HEIGHT = 44;
const VERTICAL_PADDING = 12;
const PREVIEW_HEIGHT = 75;
const PREVIEW_GAP = 4;
const PREVIEW_TOP_MARGIN = 5;
const CLOSE_BUTTON_OVERFLOW = 7;

export const BottomBar = React.memo(function BottomBar() {
  const [selectedTool, setSelectedTool] = useState<ToolType>("select");
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    isAIMode,
    setIsAIMode,
    contextCards,
    removeFromContext,
    clearContext,
    addMessage,
    addPendingCard,
    updatePendingCard,
    pendingCards,
    currentModel,
    getCanvasNodes,
    getViewport,
  } = useAIContext();

  // Track line count to conditionally disable transitions
  const prevLineCountRef = useRef(1);
  const [lineCount, setLineCount] = useState(1);

  // Update line count based on content height (handles wrapping)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      if (!inputValue) {
        setLineCount(1);
        textarea.style.height = 'auto';
        return;
      }

      // Reset height to auto to get correct scrollHeight
      textarea.style.height = 'auto';

      const newLines = Math.ceil(textarea.scrollHeight / LINE_HEIGHT);
      setLineCount(Math.min(Math.max(1, newLines), MAX_LINES));

      // Restore calculated height (will be handled by render)
      textarea.style.height = `${Math.min(Math.max(1, newLines), MAX_LINES) * LINE_HEIGHT}px`;
    }
  }, [inputValue]);

  // Check if line count INCREASED compared to the committed ref
  // This ensures we snap instantly when adding lines (preventing clipping),
  // but still animate when deleting lines or changing modes
  const isLineCountIncrease = lineCount > prevLineCountRef.current;

  // Update ref in effect (after commit) so the next render treats it as stable
  useEffect(() => {
    prevLineCountRef.current = lineCount;
  }, [lineCount]);

  const inputAreaHeight = DEFAULT_HEIGHT;
  const hasContextCards = isAIMode && contextCards.length > 0;
  const previewsHeight = hasContextCards ? CLOSE_BUTTON_OVERFLOW + PREVIEW_HEIGHT + PREVIEW_GAP + PREVIEW_TOP_MARGIN : 0;
  const extraInputHeight = lineCount > 1 ? (lineCount - 1) * LINE_HEIGHT : 0;
  const containerHeight = inputAreaHeight + previewsHeight + extraInputHeight;

  // Transitions: snap if increasing lines, otherwise animate
  const bottomTransition = isLineCountIncrease ? "none" : "bottom 0.2s ease-out";

  useEffect(() => {
    if (isAIMode && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isAIMode]);

  useEffect(() => {
    if (!isAIMode) {
      clearContext();
    }
  }, [isAIMode, clearContext]);

  // Handle click outside - first clears context, second exits AI mode
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isAIMode && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (contextCards.length > 0) {
          clearContext();
        } else {
          setIsAIMode(false);
          setInputValue("");
          setSelectedTool("select");
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAIMode, setIsAIMode, clearContext, contextCards.length]);

  // Handle Escape key - first clears context, second exits AI mode
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAIMode) {
        if (contextCards.length > 0) {
          clearContext();
        } else {
          setIsAIMode(false);
          setInputValue("");
          setSelectedTool("select");
        }
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isAIMode, setIsAIMode, clearContext, contextCards.length]);

  const handleToolClick = useCallback((tool: ToolType) => {
    if (tool === "ai") {
      setIsAIMode(true);
      setSelectedTool("ai");
    } else {
      setSelectedTool(tool);
    }
  }, [setIsAIMode]);

  // Extract design system context from context cards
  const getDesignSystemContext = useCallback((): DesignSystemNodeData | undefined => {
    const dsCard = contextCards.find(c => c.type === "designSystem");
    return dsCard?.designSystem;
  }, [contextCards]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const query = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    try {
      // Step 1: Classify the query
      const classification = await classifyQuery({
        query,
        hasContextCards: contextCards.length > 0,
        contextCardCount: contextCards.length,
        contextCardTypes: contextCards.map(c => c.type),
        hasSelectedCards: contextCards.length > 0,
      });

      console.log("Classification:", classification);
      console.log("Context cards:", contextCards);

      // Step 2: Handle based on classification type
      if (classification.type === "question") {
        // For questions, just add to message history (no card creation)
        addMessage("user", query);

        // Stream response (but don't create a card)
        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: query }],
            contextCards: contextCards,
            model: classification.modelRecommendation || currentModel,
            designSystemContext: getDesignSystemContext(),
          }),
        });

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullResponse = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullResponse += decoder.decode(value, { stream: true });
          }

          addMessage("assistant", fullResponse);
        }
      } else if (classification.type === "text_generation" || classification.type === "card_edit") {
        // Create a text card with smart positioning and classifier specs
        const cardSpec = classification.cards?.[0] || { title: "AI Response", suggestedWidth: 450, suggestedHeight: 350 };
        const cardId = `ai-${Date.now()}`;
        const canvasNodes = getCanvasNodes();
        const viewport = getViewport();
        const contextNodeIds = contextCards.map(c => c.nodeId);

        // Pass viewport info for smart positioning
        const position = calculateCardPosition(
          canvasNodes,
          contextNodeIds,
          0,
          1,
          viewport || undefined,
          cardSpec.suggestedWidth,
          cardSpec.suggestedHeight
        );

        // Create pending card (appears as skeleton with shimmer)
        addPendingCard({
          id: cardId,
          title: cardSpec.title,
          content: "Generating...",
          isComplete: false,
          sourceNodeId: contextCards[0]?.nodeId || "",
          position,
          width: cardSpec.suggestedWidth,
          height: cardSpec.suggestedHeight,
        });

        // Stream the response
        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: query }],
            contextCards: contextCards,
            model: classification.modelRecommendation || currentModel,
            designSystemContext: getDesignSystemContext(),
          }),
        });

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulatedContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;
            updatePendingCard(cardId, { content: accumulatedContent });
          }

          // Mark as complete
          updatePendingCard(cardId, { isComplete: true });
        }
      } else if (classification.type === "variation") {
        console.log("Handling variation - type: variation");
        // Parallel variation streams using classifier's card specs
        const cardCount = classification.cardCount || 3;
        const cardSpecs = classification.cards || [];
        const variationEntities = classification.variationEntities || [];
        const modelRecommendation = classification.modelRecommendation || currentModel;

        // Check if this is an image variation (model is an image generation model)
        const isImageVariation = modelRecommendation.includes("image") ||
          modelRecommendation.includes("seedream");

        // Check if this is a sketch/wireframe variation (sketch in context)
        const hasSketchInContext = contextCards.some(c => c.type === "sketch");
        const isSketchVariation = hasSketchInContext;

        // Check if this is a design variation (design in context or query mentions design/variants)
        const hasDesignInContext = contextCards.some(c => c.nodeId.includes("design"));
        const isDesignVariation = hasDesignInContext || inputValue.toLowerCase().includes("/variants");

        console.log("Variation flags:", { isImageVariation, isSketchVariation, isDesignVariation, hasSketchInContext, contextCards });

        const canvasNodes = getCanvasNodes();
        const viewport = getViewport();
        const contextNodeIds = contextCards.map(c => c.nodeId);

        let cardIds: string[] = [];

        // Constants for layout
        // Use image dimensions if it's an image variation, otherwise text dimensions
        const CARD_W = isImageVariation ? (cardSpecs[0]?.suggestedWidth || 512) :
          isSketchVariation ? (cardSpecs[0]?.suggestedWidth || 380) :
          isDesignVariation ? (cardSpecs[0]?.suggestedWidth || 430) : 450;
        const CARD_H = isImageVariation ? (cardSpecs[0]?.suggestedHeight || 512) :
          isSketchVariation ? (cardSpecs[0]?.suggestedHeight || 800) :
          isDesignVariation ? (cardSpecs[0]?.suggestedHeight || 900) : 350;
        const SPACING = 32;
        const PADDING_X = 20;
        const PADDING_TOP = 42;
        const PADDING_BOTTOM = 42;

        if (classification.sectionTitle) {
          // 1. Calculate dimensions for the strict row layout
          // Use suggestedWidth from first card if available, else default
          const itemWidth = cardSpecs[0]?.suggestedWidth || CARD_W;
          const itemHeight = cardSpecs[0]?.suggestedHeight || CARD_H;

          const totalContentWidth = (cardCount * itemWidth) + ((cardCount - 1) * SPACING);
          const sectionWidth = totalContentWidth + (PADDING_X * 2);
          const sectionHeight = itemHeight + PADDING_TOP + PADDING_BOTTOM;

          // 2. Find a spot for the WHOLE section
          const sectionPos = calculateCardPosition(
            canvasNodes,
            contextNodeIds,
            0,
            1, // Treat as 1 big unit
            viewport || undefined,
            sectionWidth,
            sectionHeight
          );

          const sectionId = `ai-section-${Date.now()}`;
          const sectionOrigin = sectionPos;

          // 3. Create the section card
          addPendingCard({
            id: sectionId,
            title: classification.sectionTitle,
            content: "",
            type: "section",
            isComplete: true,
            sourceNodeId: contextCards[0]?.nodeId || "",
            position: sectionOrigin,
            width: sectionWidth,
            height: sectionHeight,
          });

          // 4. Create cards with strict relative positioning
          for (let i = 0; i < cardCount; i++) {
            const cardId = `ai-variation-${Date.now()}-${i}`;
            const spec = cardSpecs[i] || { title: `Variation ${i + 1}`, suggestedWidth: CARD_W, suggestedHeight: CARD_H };
            const thisWidth = spec.suggestedWidth || CARD_W;
            const thisHeight = spec.suggestedHeight || CARD_H;

            const relativeX = PADDING_X + (i * (thisWidth + SPACING));
            const relativeY = PADDING_TOP;

            const cardType = isImageVariation ? "image" : isSketchVariation ? "sketch" : isDesignVariation ? "design" : "text";
            console.log(`Creating card ${i}: type=${cardType}, isSketchVariation=${isSketchVariation}`);

            addPendingCard({
              id: cardId,
              title: spec.title,
              content: isImageVariation ? "Generating image..." : `Generating variation ${i + 1}...`,
              isComplete: false,
              sourceNodeId: contextCards[0]?.nodeId || "",
              position: { x: relativeX, y: relativeY },
              width: thisWidth,
              height: thisHeight,
              parentId: sectionId,
              type: cardType
            });

            cardIds.push(cardId);
          }
        } else {
          // Fallback: standard positioning without section wrapper
          const positions = calculateVariationPositions(
            canvasNodes,
            contextNodeIds,
            cardCount,
            viewport || undefined
          );

          positions.forEach((position, index) => {
            const spec = cardSpecs[index] || { title: `Variation ${index + 1}`, suggestedWidth: 450, suggestedHeight: 350 };
            const cardId = `ai-variation-${Date.now()}-${index}`;

            const cardType = isImageVariation ? "image" : isSketchVariation ? "sketch" : isDesignVariation ? "design" : "text";
            console.log(`Creating card ${index} (no section): type=${cardType}, isSketchVariation=${isSketchVariation}`);

            addPendingCard({
              id: cardId,
              title: spec.title,
              content: isImageVariation ? "Generating image..." : `Generating variation ${index + 1}...`,
              isComplete: false,
              sourceNodeId: contextCards[0]?.nodeId || "",
              position,
              width: spec.suggestedWidth,
              height: spec.suggestedHeight,
              type: cardType
            });
            cardIds.push(cardId);
          });
        }

        // Generate all variations in parallel
        const variationPromises = cardIds.map(async (cardId, index) => {
          try {
            const variationEntity = variationEntities[index];

            if (isImageVariation) {
              // Image variation: use image generation API
              updatePendingCard(cardId, { content: "Calling image generation API..." });

              const response = await fetch("/api/ai/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt: variationEntity ? `${query} - Focus on: ${variationEntity}` : query,
                  model: modelRecommendation,
                  contextCards: contextCards
                }),
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
                const errorMessage = errorData.details || errorData.error || "Image generation failed";
                throw new Error(errorMessage);
              }

              updatePendingCard(cardId, { content: "Processing image response..." });

              const { imageUrl } = await response.json();

              if (!imageUrl) {
                throw new Error("No image URL received");
              }

              // Validate image URL format
              const isValidUrl = imageUrl.startsWith("data:image") || imageUrl.startsWith("http://") || imageUrl.startsWith("https://");
              if (!isValidUrl) {
                throw new Error("Invalid image URL format");
              }

              // Tag the pending card content with IMAGE_URL: prefix so OverviewCanvas creates an ImageNode
              updatePendingCard(cardId, { content: `IMAGE_URL:${imageUrl}`, isComplete: true });
            } else if (isDesignVariation) {
              // Design variation: use stream API with design intent
              const designContext = contextCards.find(c => c.nodeId.includes("design"));
              const canvasNodesInner = getCanvasNodes();
              const designNode = designContext ? canvasNodesInner.find(n => n.id === designContext.nodeId) : null;
              const existingHtml = (designNode?.data as { htmlContent?: string })?.htmlContent || "";

              const response = await fetch("/api/ai/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: [{
                    role: "user",
                    content: existingHtml
                      ? `Create variation ${index + 1} of this design. Here is the original HTML:\n\n${existingHtml}\n\nMake it visually different while keeping the same purpose.`
                      : `Create design variation ${index + 1}: ${query}`
                  }],
                  contextCards: contextCards,
                  model: modelRecommendation,
                  intent: "design",
                  designSystemContext: getDesignSystemContext(),
                }),
              });

              if (!response.ok) {
                const errorText = await response.text().catch(() => "Unknown error");
                throw new Error(`HTTP ${response.status}: ${errorText}`);
              }

              if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let accumulatedContent = "";

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value, { stream: true });
                  accumulatedContent += chunk;
                }

                updatePendingCard(cardId, { content: accumulatedContent, isComplete: true });
              } else {
                throw new Error("No response body");
              }
            } else if (isSketchVariation) {
              // Sketch/wireframe variation: use stream API with wireframe intent
              const sketchContext = contextCards.find(c => c.type === "sketch");
              const canvasNodesInner = getCanvasNodes();
              const sketchNode = sketchContext ? canvasNodesInner.find(n => n.id === sketchContext.nodeId) : null;
              const existingElements = (sketchNode?.data as { elements?: unknown[] })?.elements || [];

              const response = await fetch("/api/ai/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: [{
                    role: "user",
                    content: `Create wireframe variation ${index + 1}: ${query}`
                  }],
                  contextCards: contextCards,
                  model: modelRecommendation,
                  intent: "wireframe",
                  variationIndex: index,
                  totalVariations: cardCount,
                  variationEntity: variationEntity,
                }),
              });

              if (!response.ok) {
                const errorText = await response.text().catch(() => "Unknown error");
                throw new Error(`HTTP ${response.status}: ${errorText}`);
              }

              if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let accumulatedContent = "";

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value, { stream: true });
                  accumulatedContent += chunk;
                }

                updatePendingCard(cardId, { content: accumulatedContent, isComplete: true });
              } else {
                throw new Error("No response body");
              }
            } else {
              // Text variation: use stream API
              const response = await fetch("/api/ai/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: [{ role: "user", content: query }],
                  contextCards: contextCards,
                  model: modelRecommendation,
                  variationIndex: index,
                  totalVariations: cardCount,
                  variationEntity: variationEntity,
                  designSystemContext: getDesignSystemContext(),
                }),
              });

              if (!response.ok) {
                const errorText = await response.text().catch(() => "Unknown error");
                throw new Error(`HTTP ${response.status}: ${errorText}`);
              }

              if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let accumulatedContent = "";

                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const chunk = decoder.decode(value, { stream: true });
                  accumulatedContent += chunk;
                  updatePendingCard(cardId, { content: accumulatedContent });
                }

                updatePendingCard(cardId, { isComplete: true });
              } else {
                throw new Error("No response body");
              }
            }
          } catch (err) {
            console.error(`Variation ${index + 1} failed:`, err);
            updatePendingCard(cardId, {
              content: `Error: ${err instanceof Error ? err.message : "Failed to generate variation"}`,
              isComplete: true
            });
          }
        });

        await Promise.all(variationPromises);
      } else if (classification.type === "sketch") {
        const cardSpec = classification.cards?.[0] || { title: "AI Sketch", suggestedWidth: 800, suggestedHeight: 600 };
        const cardId = `ai-sketch-${Date.now()}`;
        const canvasNodes = getCanvasNodes();
        const viewport = getViewport();
        const contextNodeIds = contextCards.map(c => c.nodeId);

        const position = calculateCardPosition(
          canvasNodes,
          contextNodeIds,
          0,
          1,
          viewport || undefined,
          cardSpec.suggestedWidth,
          cardSpec.suggestedHeight
        );

        addPendingCard({
          id: cardId,
          title: cardSpec.title,
          content: "Sketching...",
          isComplete: false,
          sourceNodeId: contextCards[0]?.nodeId || "",
          position,
          width: cardSpec.suggestedWidth,
          height: cardSpec.suggestedHeight,
          type: "sketch",
        });

        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: query }],
            contextCards: contextCards,
            model: classification.modelRecommendation || currentModel,
            intent: "sketch",
            designSystemContext: getDesignSystemContext(),
          }),
        });

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulatedContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;
            updatePendingCard(cardId, { content: accumulatedContent });
          }

          updatePendingCard(cardId, { isComplete: true });
        }
      } else if (classification.type === "wireframe") {
        // Create a wireframe card (Excalidraw-based wireframe)
        const cardSpec = classification.cards?.[0] || { title: "Wireframe", suggestedWidth: 380, suggestedHeight: 800 };
        const cardId = `ai-wireframe-${Date.now()}`;
        const canvasNodes = getCanvasNodes();
        const viewport = getViewport();
        const contextNodeIds = contextCards.map(c => c.nodeId);

        const position = calculateCardPosition(
          canvasNodes,
          contextNodeIds,
          0,
          1,
          viewport || undefined,
          cardSpec.suggestedWidth,
          cardSpec.suggestedHeight
        );

        addPendingCard({
          id: cardId,
          title: cardSpec.title,
          content: "Creating wireframe...",
          isComplete: false,
          sourceNodeId: contextCards[0]?.nodeId || "",
          position,
          width: cardSpec.suggestedWidth,
          height: cardSpec.suggestedHeight,
          type: "sketch", // Wireframes use the sketch node type (Excalidraw)
        });

        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: query }],
            contextCards: contextCards,
            model: classification.modelRecommendation || currentModel,
            intent: "wireframe", // Uses WIREFRAME_SYSTEM_PROMPT
            designSystemContext: getDesignSystemContext(),
          }),
        });

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulatedContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;
            updatePendingCard(cardId, { content: accumulatedContent });
          }

          updatePendingCard(cardId, { isComplete: true });
        }
      } else if (classification.type === "design") {
        // Create a design card for HTML/CSS UI designs
        const cardSpec = classification.cards?.[0] || { title: "UI Design", suggestedWidth: 430, suggestedHeight: 900 };
        const cardId = `ai-design-${Date.now()}`;
        const canvasNodes = getCanvasNodes();
        const viewport = getViewport();
        const contextNodeIds = contextCards.map(c => c.nodeId);

        const position = calculateCardPosition(
          canvasNodes,
          contextNodeIds,
          0,
          1,
          viewport || undefined,
          cardSpec.suggestedWidth,
          cardSpec.suggestedHeight
        );

        addPendingCard({
          id: cardId,
          title: cardSpec.title,
          content: "Designing...",
          isComplete: false,
          sourceNodeId: contextCards[0]?.nodeId || "",
          position,
          width: cardSpec.suggestedWidth,
          height: cardSpec.suggestedHeight,
          type: "design",
        });

        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: query }],
            contextCards: contextCards,
            model: classification.modelRecommendation || currentModel,
            intent: "design",
            designSystemContext: getDesignSystemContext(),
          }),
        });

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulatedContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;
            updatePendingCard(cardId, { content: accumulatedContent });
          }

          updatePendingCard(cardId, { isComplete: true });
        }
      } else if (classification.type === "design_edit") {
        // Edit existing design in context
        const designContext = contextCards.find(c => c.type === "text" || c.nodeId.includes("design"));
        if (!designContext) {
          addMessage("assistant", "Please select a design to edit first.");
          return;
        }

        // Get the existing htmlContent from the node
        const canvasNodes = getCanvasNodes();
        const designNode = canvasNodes.find(n => n.id === designContext.nodeId);
        const existingHtml = (designNode?.data as { htmlContent?: string })?.htmlContent || "";

        // Mark original node as pending (will show loading state)
        addPendingCard({
          id: designContext.nodeId, // Use same ID to update existing node
          title: (designNode?.data as { title?: string })?.title || "Design",
          content: "Updating design...",
          isComplete: false,
          sourceNodeId: designContext.nodeId,
          position: designNode?.position || { x: 0, y: 0 },
          width: (designNode?.data as { frameWidth?: number })?.frameWidth || 430,
          height: (designNode?.data as { frameHeight?: number })?.frameHeight || 900,
          type: "design",
        });

        // Send edit request with existing HTML
        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user", content: `Here is the current HTML design:\n\n${existingHtml}\n\nApply this edit: ${query}` }
            ],
            contextCards: contextCards,
            model: classification.modelRecommendation || currentModel,
            intent: "design",
            designSystemContext: getDesignSystemContext(),
          }),
        });

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulatedContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;
          }

          // Update the original node with new content
          updatePendingCard(designContext.nodeId, {
            content: accumulatedContent,
            isComplete: true
          });
        }
      } else if (classification.type === "image_generation" || classification.type === "image_edit") {
        const cardSpec = classification.cards?.[0] || { title: "Generated Image", suggestedWidth: 512, suggestedHeight: 512 };
        const cardId = `ai-image-${Date.now()}`;
        const canvasNodes = getCanvasNodes();
        const viewport = getViewport();
        const contextNodeIds = contextCards.map(c => c.nodeId);
        const position = calculateCardPosition(canvasNodes, contextNodeIds, 0, 1, viewport || undefined, cardSpec.suggestedWidth, cardSpec.suggestedHeight);

        // Add pending card as placeholder
        addPendingCard({
          id: cardId,
          title: cardSpec.title,
          content: "Generating image...",
          isComplete: false,
          sourceNodeId: "",
          position,
          width: cardSpec.suggestedWidth,
          height: cardSpec.suggestedHeight
        });

        updatePendingCard(cardId, { content: "Calling image generation API..." });

        const response = await fetch("/api/ai/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: query,
            model: classification.modelRecommendation || "google/gemini-2.5-flash-image",
            contextCards: contextCards
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          const errorMessage = errorData.details || errorData.error || "Image generation failed";
          console.error("Image generation API error:", errorData);
          updatePendingCard(cardId, { content: `Error: ${errorMessage}`, isComplete: true });
          throw new Error(errorMessage);
        }

        updatePendingCard(cardId, { content: "Processing image response..." });

        const { imageUrl } = await response.json();

        if (!imageUrl) {
          updatePendingCard(cardId, { content: "Error: No image URL received", isComplete: true });
          throw new Error("No image URL received");
        }

        // Validate image URL format
        const isValidUrl = imageUrl.startsWith("data:image") || imageUrl.startsWith("http://") || imageUrl.startsWith("https://");
        if (!isValidUrl) {
          console.error("Invalid image URL format:", imageUrl.substring(0, 100));
          updatePendingCard(cardId, { content: `Error: Invalid image URL format. Received: ${imageUrl.substring(0, 50)}...`, isComplete: true });
          throw new Error("Invalid image URL format");
        }

        console.log("Image generated successfully:", {
          cardId,
          imageUrlLength: imageUrl.length,
          imageUrlPrefix: imageUrl.substring(0, 50),
          isValidDataUrl: imageUrl.startsWith("data:image"),
        });

        // Tag the pending card content with IMAGE_URL: prefix so OverviewCanvas creates an ImageNode
        updatePendingCard(cardId, { content: `IMAGE_URL:${imageUrl}`, isComplete: true });
      } else if (classification.type === "research") {
        // 1. Create the container section
        const sectionId = `ai-section-${Date.now()}`;
        const cardSpec = classification.cards?.[0] || { title: "Research Results", suggestedWidth: 450, suggestedHeight: 1200 };
        const canvasNodes = getCanvasNodes();
        const viewport = getViewport();
        const contextNodeIds = contextCards.map(c => c.nodeId);

        // Constants for layout
        const COLS = 3;
        const CARD_W = 400;
        const CARD_H = 300;
        const SPACING = 32;
        const PADDING_X = 20;
        const PADDING_TOP = 60;

        // Calculate total section size based on expected results (approx 5-6)
        const EXPECTED_RESULTS = 6;
        const ROWS = Math.ceil(EXPECTED_RESULTS / COLS);
        const sectionWidth = (COLS * CARD_W) + ((COLS - 1) * SPACING) + (PADDING_X * 2);
        const sectionHeight = (ROWS * CARD_H) + ((ROWS - 1) * SPACING) + PADDING_TOP + PADDING_X;

        const position = calculateCardPosition(
          canvasNodes,
          contextNodeIds,
          0,
          1,
          viewport || undefined,
          sectionWidth,
          sectionHeight
        );

        addPendingCard({
          id: sectionId,
          title: classification.sectionTitle || "Research Results",
          content: "",
          type: "section",
          isComplete: true,
          sourceNodeId: contextCards[0]?.nodeId || "",
          position,
          width: sectionWidth,
          height: sectionHeight,
        });

        // 2. Call Research API
        const response = await fetch("/api/ai/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          throw new Error("Research failed");
        }

        const data = await response.json();
        const results = data.results || [];

        if (results.length === 0) {
          // Create a "No results" card
          addPendingCard({
            id: `ai-res-empty-${Date.now()}`,
            title: "No Results",
            content: "Could not find any relevant information.",
            isComplete: true,
            sourceNodeId: "",
            position: { x: PADDING_X, y: PADDING_TOP },
            width: CARD_W,
            height: 100,
            parentId: sectionId,
            type: "text"
          });
          return;
        }

        // 3. Create cards for results
        results.forEach((result: any, index: number) => {
          const cardId = `ai-res-${Date.now()}-${index}`;
          const row = Math.floor(index / COLS);
          const col = index % COLS;

          const relX = PADDING_X + col * (CARD_W + SPACING);
          const relY = PADDING_TOP + row * (CARD_H + SPACING);

          // Access Exa result fields (title, text, image, url)
          const content = `## ${result.title}\n\n${result.text}\n\n[Read Source](${result.url})${result.image ? `\n\n![Image](${result.image})` : ""}`;

          // If it has an image and very little text, maybe make it an image node?
          // For now, stick to text nodes for consistency.

          addPendingCard({
            id: cardId,
            title: result.title || "Untitled",
            content: content,
            isComplete: true,   // Immediately complete
            sourceNodeId: "",
            position: { x: relX, y: relY },
            width: CARD_W,
            height: CARD_H,
            parentId: sectionId,
            type: "text"
          });
        });
      } else if (classification.type === "inspiration") {
        // Call Inspire API first to determine what we're getting
        const response = await fetch("/api/ai/inspire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          throw new Error("Inspiration search failed");
        }

        const data = await response.json();
        const results = data.results || [];

        if (results.length === 0) {
          // Create a simple "No results" card
          const noResultId = `ai-inspire-empty-${Date.now()}`;
          const canvasNodes = getCanvasNodes();
          const viewport = getViewport();
          const position = calculateCardPosition(canvasNodes, [], 0, 1, viewport || undefined);
          addPendingCard({
            id: noResultId,
            title: "No Results",
            content: "Could not find any design inspiration. Try a different search term.",
            isComplete: true,
            sourceNodeId: "",
            position,
            width: 400,
            height: 150,
            type: "text"
          });
          return;
        }

        const firstResult = results[0];

        // Check if this is a saved section (curated flow)
        if (firstResult.type === "section" && firstResult.sectionData) {
          // Recreate the entire saved section with original layout
          const sectionData = firstResult.sectionData;
          const canvasNodes = getCanvasNodes();
          const viewport = getViewport();
          const contextNodeIds = contextCards.map(c => c.nodeId);

          const position = calculateCardPosition(
            canvasNodes,
            contextNodeIds,
            0,
            1,
            viewport || undefined,
            sectionData.frameWidth,
            sectionData.frameHeight
          );

          const sectionId = `ai-section-${Date.now()}`;

          // Create the section node
          addPendingCard({
            id: sectionId,
            title: firstResult.title,
            content: "",
            type: "section",
            isComplete: true,
            sourceNodeId: "",
            position,
            width: sectionData.frameWidth,
            height: sectionData.frameHeight,
          });

          // Create all image nodes with their original positions
          sectionData.images.forEach((img: any, index: number) => {
            const cardId = `ai-inspire-${Date.now()}-${index}`;
            addPendingCard({
              id: cardId,
              title: img.label || "Image",
              content: `IMAGE_URL:${img.url}`,
              isComplete: true,
              sourceNodeId: "",
              position: img.position,
              width: img.width,
              height: img.height,
              parentId: sectionId,
              type: "image"
            });
          });
        } else {
          // Individual images - create a grid section
          const sectionId = `ai-section-${Date.now()}`;
          const canvasNodes = getCanvasNodes();
          const viewport = getViewport();
          const contextNodeIds = contextCards.map(c => c.nodeId);

          // Constants for layout
          const COLS = 4;
          const CARD_W = 360;
          const CARD_H = 500;
          const SPACING = 24;
          const PADDING_X = 20;
          const PADDING_TOP = 50;

          // Calculate section size based on results
          const ROWS = Math.ceil(results.length / COLS);
          const sectionWidth = (COLS * CARD_W) + ((COLS - 1) * SPACING) + (PADDING_X * 2);
          const sectionHeight = (ROWS * CARD_H) + ((ROWS - 1) * SPACING) + PADDING_TOP + 40;

          const position = calculateCardPosition(
            canvasNodes,
            contextNodeIds,
            0,
            1,
            viewport || undefined,
            sectionWidth,
            sectionHeight
          );

          addPendingCard({
            id: sectionId,
            title: classification.sectionTitle || "Design Inspiration",
            content: "",
            type: "section",
            isComplete: true,
            sourceNodeId: "",
            position,
            width: sectionWidth,
            height: sectionHeight,
          });

          // Create image cards for results in a grid
          results.forEach((result: any, index: number) => {
            const cardId = `ai-inspire-${Date.now()}-${index}`;
            const row = Math.floor(index / COLS);
            const col = index % COLS;

            const relX = PADDING_X + col * (CARD_W + SPACING);
            const relY = PADDING_TOP + row * (CARD_H + SPACING);

            addPendingCard({
              id: cardId,
              title: result.title || "Design Inspiration",
              content: `IMAGE_URL:${result.image}`,
              isComplete: true,
              sourceNodeId: "",
              position: { x: relX, y: relY },
              width: CARD_W,
              height: CARD_H,
              parentId: sectionId,
              type: "image"
            });
          });
        }
      } else if (classification.type === "design_system_import") {
        // Parse design tokens from CSS and create section with Typography and Colors nodes
        const rawDesignTokens = classification.rawDesignTokens || "";
        console.log("[DesignSystemImport] Raw design tokens:", rawDesignTokens);

        if (!rawDesignTokens) {
          throw new Error("No design tokens found in query");
        }

        const { parseDesignTokensCSS } = await import("@/lib/design-tokens/parser");
        const designSystem = parseDesignTokensCSS(rawDesignTokens);
        console.log("[DesignSystemImport] Parsed design system:", designSystem);
        console.log("[DesignSystemImport] Colors:", designSystem.colors.length);
        console.log("[DesignSystemImport] Typography:", designSystem.typography.length);

        const canvasNodes = getCanvasNodes();
        const viewport = getViewport();
        const contextNodeIds = contextCards.map(c => c.nodeId);

        const CARD_W = 400;
        const CARD_H = 600;
        const SPACING = 32;
        const PADDING_X = 20;
        const PADDING_TOP = 42;
        const PADDING_BOTTOM = 42;

        const sectionWidth = (2 * CARD_W) + SPACING + (PADDING_X * 2);
        const sectionHeight = CARD_H + PADDING_TOP + PADDING_BOTTOM;

        const sectionId = `design-system-${Date.now()}`;
        const sectionPosition = calculateCardPosition(
          canvasNodes,
          contextNodeIds,
          0,
          1,
          viewport || undefined,
          sectionWidth,
          sectionHeight
        );

        // Create section node
        addPendingCard({
          id: sectionId,
          title: classification.sectionTitle || "Design System",
          content: "",
          type: "section",
          isComplete: true,
          sourceNodeId: "",
          position: sectionPosition,
          width: sectionWidth,
          height: sectionHeight,
        });

        const typographyNodeId = `typography-${Date.now()}`;
        const colorsNodeId = `colors-${Date.now()}`;

        // Build typography content
        const typographyLines: string[] = [];
        typographyLines.push(`# ${classification.sectionTitle || "Design System"}`);
        typographyLines.push("");
        typographyLines.push("## Typography");
        typographyLines.push("");

        if (designSystem.typography.length > 0) {
          designSystem.typography.forEach((type) => {
            typographyLines.push(`**${type.name}**`);
            typographyLines.push(type.sample);
            typographyLines.push("");
          });
        } else {
          typographyLines.push("No typography styles found.");
        }

        // Create typography node
        addPendingCard({
          id: typographyNodeId,
          title: "Typography",
          content: typographyLines.join("\n"),
          isComplete: true,
          sourceNodeId: "",
          position: { x: PADDING_X, y: PADDING_TOP },
          width: CARD_W,
          height: CARD_H,
          parentId: sectionId,
          type: "text"
        });

        // Build colors content
        const colorsLines: string[] = [];
        colorsLines.push(`# ${classification.sectionTitle || "Design System"}`);
        colorsLines.push("");
        colorsLines.push("## Colors");
        colorsLines.push("");

        if (designSystem.colors.length > 0) {
          designSystem.colors.forEach((color) => {
            colorsLines.push(`**${color.name}**`);
            colorsLines.push(color.hex);
            colorsLines.push("");
          });
        } else {
          colorsLines.push("No color styles found.");
        }

        // Create colors node
        addPendingCard({
          id: colorsNodeId,
          title: "Colors",
          content: colorsLines.join("\n"),
          isComplete: true,
          sourceNodeId: "",
          position: { x: PADDING_X + CARD_W + SPACING, y: PADDING_TOP },
          width: CARD_W,
          height: CARD_H,
          parentId: sectionId,
          type: "text"
        });

        console.log("[DesignSystemImport] Created design system section with typography and colors nodes");
      }

    } catch (error) {
      console.error("AI Send error:", error);
      // Don't create error card if we're in a variation flow - variations handle their own errors
      // Check if we have any pending cards (which would indicate we started creating cards)
      const hasStartedCreatingCards = pendingCards.length > 0;
      if (!hasStartedCreatingCards) {
        // Only create error card if we haven't started creating any cards yet
        const errorCardId = `ai-error-${Date.now()}`;
        const canvasNodes = getCanvasNodes();
        const viewport = getViewport();
        const position = calculateCardPosition(canvasNodes, [], 0, 1, viewport || undefined);
        addPendingCard({
          id: errorCardId,
          title: "Error",
          content: "Something went wrong. Please try again.",
          isComplete: true,
          sourceNodeId: "",
          position,
          width: 450,
          height: 150,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, contextCards, pendingCards, addMessage, addPendingCard, updatePendingCard, currentModel, getCanvasNodes, getViewport, getDesignSystemContext]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const getIconColor = (tool: ToolType) => {
    return selectedTool === tool ? "#000000" : "#424242";
  };

  const toolbarWidth = 6 + 32 * 6 + 10 * 5 + 6;
  const aiInputWidth = 400;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div
        ref={containerRef}
        className="shadow-default"
        style={{
          height: containerHeight,
          width: isAIMode ? (hasContextCards ? aiInputWidth + 80 : aiInputWidth) : toolbarWidth,
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          transition: `width 0.3s cubic-bezier(0.4, 0, 0.2, 1)${isLineCountIncrease ? "" : ", height 0.2s ease-out"}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Previews layer - positioned from bottom to stay in sync with input area growth */}
        {hasContextCards && (
          <div
            className="preview-scroll"
            style={{
              position: "absolute",
              bottom: inputAreaHeight + extraInputHeight + PREVIEW_GAP,
              left: 0,
              right: 0,
              height: CLOSE_BUTTON_OVERFLOW + PREVIEW_HEIGHT + PREVIEW_GAP,
              display: "flex",
              gap: 6,
              zIndex: 1,
              animation: "fadeIn 0.15s ease-out forwards",
              overflowX: "auto",
              overflowY: "hidden",
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: CLOSE_BUTTON_OVERFLOW,
              paddingBottom: PREVIEW_GAP,
              transition: bottomTransition,
            }}
          >
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              .preview-scroll::-webkit-scrollbar {
                display: none;
              }
              .preview-scroll {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>
            {contextCards.map((card) => (
              <ContextPreviewCard
                key={card.id}
                type={card.type}
                title={card.title}
                imageUrl={card.imageUrl}
                designSystem={card.designSystem}
                onRemove={() => removeFromContext(card.nodeId)}
              />
            ))}
          </div>
        )}

        {/* Input container - white background, stays on top */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: inputAreaHeight + extraInputHeight,
            backgroundColor: "#FFFFFF",
            zIndex: 10,
            paddingLeft: isAIMode ? 12 : 6,
            paddingRight: isAIMode ? 12 : 6,
            paddingTop: VERTICAL_PADDING,
            paddingBottom: VERTICAL_PADDING,
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* Icons Layer */}
          <div
            style={{
              position: "absolute",
              left: 6,
              right: 6,
              top: VERTICAL_PADDING,
              bottom: VERTICAL_PADDING,
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: isAIMode ? 0 : 1,
              transform: isAIMode ? "scale(0.95)" : "scale(1)",
              transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
              pointerEvents: isAIMode ? "none" : "auto",
            }}
          >
            <ToolButton
              tool="select"
              selected={selectedTool === "select"}
              onClick={() => handleToolClick("select")}
              icon={<CursorIcon color={getIconColor("select")} />}
              visible={!isAIMode}
            />
            <ToolButton
              tool="text"
              selected={selectedTool === "text"}
              onClick={() => handleToolClick("text")}
              icon={<TextIcon color={getIconColor("text")} />}
              visible={!isAIMode}
            />
            <ToolButton
              tool="audio"
              selected={selectedTool === "audio"}
              onClick={() => handleToolClick("audio")}
              icon={<MicIcon color={getIconColor("audio")} />}
              visible={!isAIMode}
            />
            <ToolButton
              tool="colors"
              selected={selectedTool === "colors"}
              onClick={() => handleToolClick("colors")}
              icon={<ColorIcon color={getIconColor("colors")} />}
              visible={!isAIMode}
            />
            <ToolButton
              tool="ai"
              selected={selectedTool === "ai"}
              onClick={() => handleToolClick("ai")}
              icon={<AISparklesIcon color={getIconColor("ai")} />}
              visible={!isAIMode}
            />
            <ToolButton
              tool="share"
              selected={selectedTool === "share"}
              onClick={() => handleToolClick("share")}
              icon={<ShareIcon color={getIconColor("share")} />}
              visible={!isAIMode}
            />
          </div>

          {/* AI Input Layer */}
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: VERTICAL_PADDING,
              bottom: VERTICAL_PADDING,
              display: "flex",
              alignItems: "center",
              opacity: isAIMode ? 1 : 0,
              transform: isAIMode ? "scale(1)" : "scale(0.95)",
              transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
              pointerEvents: isAIMode ? "auto" : "none",
            }}
          >
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={isLoading ? "Processing..." : "Do anything..."}
              disabled={isLoading}
              rows={lineCount}
              style={{
                flex: 1,
                height: lineCount * LINE_HEIGHT,
                border: "none",
                outline: "none",
                backgroundColor: "transparent",
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 500,
                fontSize: 14,
                letterSpacing: "-0.015em",
                color: isLoading ? "#898989" : "#424242",
                caretColor: "#424242",
                resize: "none",
                lineHeight: `${LINE_HEIGHT}px`,
                padding: 0,
                paddingRight: 40, // 20px icon + 12px gap + tolerance
                overflow: lineCount >= MAX_LINES ? "auto" : "hidden",
                cursor: isLoading ? "wait" : "text",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: inputValue.trim() ? "pointer" : "default",
                opacity: inputValue.trim() ? 1 : 0.5,
                transition: "opacity 0.15s ease",
              }}
              onClick={handleSend}
            >
              <ArrowRightIcon color={inputValue.trim() ? "#424242" : "#878787"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
