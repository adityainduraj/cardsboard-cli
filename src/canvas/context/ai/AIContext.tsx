"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Node } from "@xyflow/react";
import { AIModel, AI_MODELS } from "@/lib/openrouter/client";
import type { DesignSystemNodeData } from "@/types/design-system";

export interface AICardContext {
  id: string;
  title: string;
  content: string;
  type: "text" | "image" | "sketch" | "designSystem";
  nodeId: string;
  imageUrl?: string;
  elements?: any[]; // For sketch/wireframe elements
  designSystem?: DesignSystemNodeData; // For design system context
}

export interface AIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: {
    contextCardIds?: string[];
    modelUsed?: AIModel;
    tokens?: number;
  };
}

export interface GeneratedCard {
  id: string;
  title: string;
  content: string;
  isComplete: boolean;
  reasoning?: string;
  sourceNodeId: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  parentId?: string; // ID of the parent section (if any)
  type?: "text" | "image" | "section" | "sketch" | "design" | "designSystem";
}

interface AIContextType {
  contextCards: AICardContext[];
  addToContext: (cards: Array<{ nodeId: string; title: string; type: "text" | "image" | "sketch" | "designSystem"; imageUrl?: string; content?: string; elements?: any[]; designSystem?: DesignSystemNodeData }>) => void;
  removeFromContext: (nodeId: string) => void;
  clearContext: () => void;
  getContextCards: () => AICardContext[];

  messages: AIMessage[];
  addMessage: (role: "user" | "assistant", content: string, metadata?: AIMessage["metadata"]) => void;
  clearMessages: () => void;

  pendingCards: GeneratedCard[];
  addPendingCard: (card: GeneratedCard) => void;
  updatePendingCard: (id: string, updates: Partial<GeneratedCard>) => void;
  removePendingCard: (id: string) => void;
  clearPendingCards: () => void;
  convertPendingToNodes: () => Node[];

  currentModel: AIModel;
  setModel: (model: AIModel) => void;
  getModel: () => AIModel;

  // AI mode state (shared between BottomBar and Canvas)
  isAIMode: boolean;
  setIsAIMode: (mode: boolean) => void;

  // Canvas nodes access (for positioning calculations)
  getCanvasNodes: () => Node[];
  setCanvasNodes: (nodes: Node[]) => void;

  // Viewport access (for smart positioning)
  getViewport: () => { viewport: { x: number; y: number; zoom: number }; screenWidth: number; screenHeight: number } | null;
  setViewport: (viewport: { x: number; y: number; zoom: number }, screenWidth: number, screenHeight: number) => void;
}

const AIContext = createContext<AIContextType | null>(null);

function calculateNodeSize(content: string): { width: number; height: number } {
  const MIN_WIDTH = 300;
  const MAX_WIDTH = 500;
  const MIN_HEIGHT = 150;
  const MAX_HEIGHT = 600;
  const CHARS_PER_LINE = 50;
  const LINE_HEIGHT = 24;
  const PADDING = 40;

  const lines = content.split('\n');
  let totalLines = 0;

  lines.forEach(line => {
    const wrappedLines = Math.ceil(line.length / CHARS_PER_LINE) || 1;
    totalLines += wrappedLines;
  });

  const contentLength = content.length;
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.min(contentLength * 3, MAX_WIDTH)));
  const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, totalLines * LINE_HEIGHT + PADDING));

  return { width, height };
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [contextCards, setContextCards] = useState<AICardContext[]>([]);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [pendingCards, setPendingCards] = useState<GeneratedCard[]>([]);
  const [currentModel, setCurrentModel] = useState<AIModel>(
    (AI_MODELS[0]?.id as AIModel) || "google/gemini-2.5-flash"
  );
  const [isAIMode, setIsAIMode] = useState(false);

  // Canvas nodes ref for positioning calculations
  const canvasNodesRef = useRef<Node[]>([]);

  const getCanvasNodes = useCallback(() => canvasNodesRef.current, []);
  const setCanvasNodes = useCallback((nodes: Node[]) => {
    canvasNodesRef.current = nodes;
  }, []);

  // Viewport ref for smart positioning
  const viewportRef = useRef<{ viewport: { x: number; y: number; zoom: number }; screenWidth: number; screenHeight: number } | null>(null);

  const getViewport = useCallback(() => viewportRef.current, []);
  const setViewport = useCallback((viewport: { x: number; y: number; zoom: number }, screenWidth: number, screenHeight: number) => {
    viewportRef.current = { viewport, screenWidth, screenHeight };
  }, []);

  const addToContext = useCallback((cards: Array<{ nodeId: string; title: string; type: "text" | "image" | "sketch" | "designSystem"; imageUrl?: string; content?: string; elements?: any[]; designSystem?: DesignSystemNodeData }>) => {
    setContextCards((prev) => {
      const existingIds = new Set(prev.map((c) => c.nodeId));
      const newCards = cards
        .filter((card) => !existingIds.has(card.nodeId))
        .map((card) => ({
          id: `context-${card.nodeId}-${Date.now()}`,
          nodeId: card.nodeId,
          title: card.title || "Untitled",
          content: card.content || "",
          type: card.type,
          imageUrl: card.imageUrl,
          elements: card.elements, // Pass elements for sketch/wireframe context
          designSystem: card.designSystem, // Pass design system data
        }));
      return [...prev, ...newCards];
    });
  }, []);

  const removeFromContext = useCallback((nodeId: string) => {
    setContextCards((prev) => prev.filter((c) => c.nodeId !== nodeId));
  }, []);

  const clearContext = useCallback(() => {
    setContextCards([]);
  }, []);

  const contextCardsRef = useRef(contextCards);
  useEffect(() => {
    contextCardsRef.current = contextCards;
  }, [contextCards]);

  const getContextCards = useCallback(() => contextCardsRef.current, []);

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string, metadata?: AIMessage["metadata"]) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          role,
          content,
          timestamp: Date.now(),
          metadata,
        },
      ]);
    },
    []
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const addPendingCard = useCallback((card: GeneratedCard) => {
    setPendingCards((prev) => [...prev, card]);
  }, []);

  const updatePendingCard = useCallback((id: string, updates: Partial<GeneratedCard>) => {
    setPendingCards((prev) => prev.map((card) => (card.id === id ? { ...card, ...updates } : card)));
  }, []);

  const removePendingCard = useCallback((id: string) => {
    setPendingCards((prev) => prev.filter((card) => card.id !== id));
  }, []);

  const clearPendingCards = useCallback(() => {
    setPendingCards([]);
  }, []);

  const convertPendingToNodes = useCallback(() => {
    const nodes: Node[] = pendingCards
      .filter((card) => card.isComplete)
      .map((card) => {
        const size = calculateNodeSize(card.content);
        return {
          id: card.id,
          type: "text" as const,
          position: card.position,
          data: {
            title: card.title,
            content: card.content,
            isAIGenerated: true,
            width: size.width,
            height: size.height,
          },
        };
      });

    clearPendingCards();
    return nodes;
  }, [pendingCards, clearPendingCards]);

  const getModel = useCallback(() => currentModel, [currentModel]);

  const providerValue = useMemo(() => ({
    contextCards,
    addToContext,
    removeFromContext,
    clearContext,
    getContextCards,
    messages,
    addMessage,
    clearMessages,
    pendingCards,
    addPendingCard,
    updatePendingCard,
    removePendingCard,
    clearPendingCards,
    convertPendingToNodes,
    currentModel,
    setModel: setCurrentModel,
    getModel,
    isAIMode,
    setIsAIMode,
    getCanvasNodes,
    setCanvasNodes,
    getViewport,
    setViewport,
  }), [
    contextCards,
    addToContext,
    removeFromContext,
    clearContext,
    getContextCards,
    messages,
    addMessage,
    clearMessages,
    pendingCards,
    addPendingCard,
    updatePendingCard,
    removePendingCard,
    clearPendingCards,
    convertPendingToNodes,
    currentModel,
    getModel,
    isAIMode,
    getCanvasNodes,
    setCanvasNodes,
    getViewport,
    setViewport,
  ]);

  return (
    <AIContext.Provider value={providerValue}>
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAIContext must be used within an AIProvider");
  }
  return context;
}
