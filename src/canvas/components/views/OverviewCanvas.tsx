"use client";
import { useCallback, useState, useEffect, useRef } from "react";
// Section counter ref is already declared in the component
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Node,
  Edge,
  SelectionMode,
  Panel,
  useStore,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NODE_TYPES, createNode, getAllNodeDefinitions } from "@/nodes/registry";
import { BottomBar } from "@/components/ai/BottomBar";
import { CanvasNavigator } from "@/components/CanvasNavigator";
import { useAIContext } from "@/context/ai/AIContext";
import { useCanvases } from "@/hooks/useCanvases";
import { SketchNodeDrawer } from "@/components/views/nodes/SketchNodeDrawer";
import { hydrateSketchElements } from "@/lib/ai/sketch-hydration";
import type { DesignSystemNodeData } from "@/types/design-system";

// PERFORMANCE: Use NODE_TYPES directly to prevent ReactFlow re-initialization
// Do NOT create a new object here - it causes all nodes to re-initialize on every render

function CanvasContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editingSketchId, setEditingSketchId] = useState<string | null>(null);
  const [isSketchDrawerOpen, setIsSketchDrawerOpen] = useState(false);
  const reactFlowInstance = useReactFlow();
  const {
    setCanvasNodes,
    setViewport,
    pendingCards,
    convertPendingToNodes,
    setIsAIMode,
    isAIMode,
    addToContext,
    removeFromContext,
    removePendingCard
  } = useAIContext();
  const { activeCanvas, saveActiveCanvas } = useCanvases();
  const hasLoadedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get current zoom level
  const zoom = useStore((s) => s.transform[2]);

  // Track previous selection to diff changes (avoids contextCards dependency)
  const prevSelectedRef = useRef<Set<string>>(new Set());

  // Sync context with selected nodes when in AI mode
  // Uses diffing against previous selection to avoid re-add loops
  // When a section is selected, adds all its children to context
  useEffect(() => {
    if (!isAIMode) {
      prevSelectedRef.current = new Set();
      return;
    }

    const currentSelected = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    const prevSelected = prevSelectedRef.current;

    // NEWLY selected nodes → add to context
    const newlySelected = nodes.filter((n) => n.selected && !prevSelected.has(n.id));

    // Expand sections to their children, with deduplication
    const nodeIdSet = new Set<string>();
    const nodesToAdd: typeof nodes = [];
    newlySelected.forEach((node) => {
      if (node.type === "section") {
        // Find all children of this section and add them
        const children = nodes.filter((n) => n.parentId === node.id);
        children.forEach((child) => {
          if (!nodeIdSet.has(child.id)) {
            nodeIdSet.add(child.id);
            nodesToAdd.push(child);
          }
        });
      } else {
        if (!nodeIdSet.has(node.id)) {
          nodeIdSet.add(node.id);
          nodesToAdd.push(node);
        }
      }
    });

    if (nodesToAdd.length > 0) {
      const cards = nodesToAdd.map((node) => {
        const nodeData = node.data as {
          title?: string;
          label?: string;
          url?: string;
          content?: string;
          name?: string;
          elements?: any[];
          vibeDescription?: string;
          colors?: any;
          typography?: any;
          spacing?: any;
          borderRadius?: any;
          shadows?: any;
          patterns?: any;
        };
        const isImage = node.type === "image";
        const isSketch = node.type === "sketch";
        const isDesignSystem = node.type === "designSystem";

        if (isDesignSystem) {
          return {
            nodeId: node.id,
            title: nodeData.name || nodeData.title || "Design System",
            type: "designSystem" as const,
            content: nodeData.content || "",
            designSystem: nodeData as DesignSystemNodeData,
          };
        }

        if (isSketch) {
          return {
            nodeId: node.id,
            title: nodeData.title || nodeData.label || "Sketch",
            type: "sketch" as const,
            content: nodeData.content || "",
            elements: nodeData.elements,
            imageUrl: (nodeData as any).previewDataUrl,
          };
        }

        return {
          nodeId: node.id,
          title: nodeData.title || nodeData.label || "Untitled",
          type: (isImage ? "image" : "text") as "text" | "image",
          imageUrl: isImage ? nodeData.url : undefined,
          content: nodeData.content,
        };
      });
      addToContext(cards);
    }

    // NEWLY deselected nodes → remove from context
    // Also handle section deselection by removing children
    prevSelected.forEach((nodeId) => {
      if (!currentSelected.has(nodeId)) {
        const deselectedNode = nodes.find((n) => n.id === nodeId);
        if (deselectedNode?.type === "section") {
          // Remove all children of this section
          const children = nodes.filter((n) => n.parentId === nodeId);
          children.forEach((child) => removeFromContext(child.id));
        } else {
          removeFromContext(nodeId);
        }
      }
    });

    // Update ref for next render
    prevSelectedRef.current = currentSelected;
  }, [isAIMode, nodes, addToContext, removeFromContext]); // NO contextCards dependency!

  // Track processed pending cards to trigger auto-pan only once
  const processedPendingIdsRef = useRef<Set<string>>(new Set());

  // Update AI context with current nodes
  useEffect(() => {
    setCanvasNodes(nodes);
  }, [nodes, setCanvasNodes]);

  // Load canvas when activeCanvas changes
  useEffect(() => {
    if (!activeCanvas) {
      // No active canvas - start fresh
      if (hasLoadedRef.current) {
        setNodes([]);
        setEdges([]);
      }
      hasLoadedRef.current = true;
      return;
    }

    // Only load if we have content and this is a different canvas
    const canvasNodes = activeCanvas.nodes || [];
    const canvasEdges = activeCanvas.edges || [];

    setNodes(canvasNodes);
    setEdges(canvasEdges);
    hasLoadedRef.current = true;
  }, [activeCanvas?.id, setNodes, setEdges]);

  // Auto-save canvas when nodes or edges change (debounced)
  useEffect(() => {
    if (!activeCanvas?.id) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save to avoid excessive writes
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveActiveCanvas(nodes, edges);
      } catch (err) {
        console.error("Failed to auto-save canvas:", err);
      }
    }, 1000); // 1 second debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges, activeCanvas?.id, saveActiveCanvas]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Convert pending cards to nodes (both pending and complete)
  // Pending cards show as skeleton, complete cards show content
  useEffect(() => {
    // Get current pending node IDs
    const pendingNodeIds = new Set(pendingCards.map(c => c.id));

    // Check for new cards to pan to
    let firstNewCardToPan: { x: number; y: number } | null = null;
    pendingCards.forEach(card => {
      if (!processedPendingIdsRef.current.has(card.id)) {
        // Only pan to top-level cards (ignore children with relative positions)
        if (!firstNewCardToPan && !card.parentId) {
          firstNewCardToPan = card.position;
        }
        processedPendingIdsRef.current.add(card.id);
      }
    });

    if (firstNewCardToPan) {
      const pos = firstNewCardToPan as { x: number; y: number };
      reactFlowInstance.setCenter(
        pos.x + 225, // Center of 450px width
        pos.y + 175, // Center of 350px height
        { zoom: 1, duration: 800 }
      );
    }

    const cardsToRemove: string[] = [];

    // Update or add pending card nodes
    setNodes((currentNodes) => {
      const existingIds = new Set(currentNodes.map(n => n.id));
      const nodesToAdd: Node[] = [];
      const nodesToUpdate: Map<string, Partial<Node>> = new Map();

      pendingCards.forEach((card) => {
        const isImage = card.content.startsWith("IMAGE_URL:");
        const imageUrl = isImage ? card.content.replace("IMAGE_URL:", "").trim() : undefined;

        let nodeType = "text";
        let sketchElements: any[] | undefined;

        if (card.type === "section") {
          nodeType = "section";
        } else if (isImage) {
          nodeType = "image";
        } else if (card.type === "sketch") {
          nodeType = "sketch";
          // Only parse elements when complete
          if (card.isComplete) {
            try {
              let jsonStr = "";
              const jsonMatch = card.content.match(/```(?:json)?\s*([\s\S]*?)```/);
              if (jsonMatch) {
                jsonStr = jsonMatch[1];
              } else {
                const firstBracket = card.content.indexOf("[");
                const lastBracket = card.content.lastIndexOf("]");
                if (firstBracket !== -1 && lastBracket > firstBracket) {
                  jsonStr = card.content.substring(firstBracket, lastBracket + 1);
                } else {
                  jsonStr = card.content;
                }
              }

              if (jsonStr.trim().startsWith("[") || jsonStr.trim().startsWith("{")) {
                const parsed = JSON.parse(jsonStr);
                const rawElements = Array.isArray(parsed) ? parsed : (parsed.elements || []);

                // 1. Initial synchronous hydration (fast, handles most cases)
                sketchElements = hydrateSketchElements(rawElements);

                // 2. Final official conversion (async, more robust for editor)
                if (card.isComplete && sketchElements && sketchElements.length > 0) {
                  import("@excalidraw/excalidraw").then(async ({ convertToExcalidrawElements, exportToCanvas }) => {
                    const converted = convertToExcalidrawElements(rawElements);

                    let previewDataUrl: string | undefined;
                    try {
                      const canvas = await exportToCanvas({
                        elements: converted,
                        appState: { viewBackgroundColor: "#ffffff", exportWithDarkMode: false },
                        files: null,
                        maxWidthOrHeight: 800,
                      });
                      previewDataUrl = canvas.toDataURL("image/png");
                    } catch (err) {
                      console.error("Failed to generate preview:", err);
                    }

                    // Update the node with final converted elements
                    setNodes((nds) => nds.map((n) =>
                      n.id === card.id
                        ? { ...n, data: { ...n.data, elements: converted, previewDataUrl } }
                        : n
                    ));
                  });
                }
              }
            } catch (e) {
              console.error("Failed to parse sketch JSON", e);
            }
          }
        } else if (card.type === "design") {
          nodeType = "design";
        }

        if (card.isComplete) {
          cardsToRemove.push(card.id);
        }

        if (!existingIds.has(card.id)) {
          // Add new pending card as node
          nodesToAdd.push({
            id: card.id,
            type: nodeType as any,
            position: card.position,
            parentId: card.parentId,
            data: {
              title: card.title,
              content: isImage ? undefined : card.content,
              htmlContent: nodeType === "design" ? card.content : undefined,
              elements: sketchElements,
              url: imageUrl || undefined,
              label: card.title,
              sectionName: card.type === "section" ? card.title : undefined,
              isAIGenerated: true,
              isPending: !card.isComplete,
              frameWidth: card.width || (nodeType === "image" ? 400 : 450),
              frameHeight: card.height || (nodeType === "image" ? 300 : 350),
              parentSectionId: card.parentId,
            },
          });
        } else {
          // Update existing node
          const existingNode = currentNodes.find(n => n.id === card.id);
          const existingType = existingNode?.type || "text";
          const needsTypeUpdate = existingType !== nodeType;

          nodesToUpdate.set(card.id, {
            ...(needsTypeUpdate ? { type: nodeType as any } : {}),
            ...(card.parentId !== existingNode?.parentId ? {
              parentId: card.parentId,
            } : {}),
            data: {
              ...existingNode?.data,
              title: card.title,
              content: isImage ? undefined : card.content,
              htmlContent: nodeType === "design" ? card.content : (existingNode?.data?.htmlContent || undefined),
              elements: sketchElements,
              url: imageUrl || existingNode?.data?.url || undefined,
              label: card.title,
              sectionName: card.type === "section" ? card.title : undefined,
              isAIGenerated: true,
              isPending: !card.isComplete,
              frameWidth: card.width || (nodeType === "image" ? 400 : 450),
              frameHeight: card.height || (nodeType === "image" ? 300 : 350),
              parentSectionId: card.parentId,
            },
          });
        }
      });

      // Apply updates
      let updatedNodes = currentNodes.map(node => {
        const update = nodesToUpdate.get(node.id);
        if (update) {
          const mergedData = { ...node.data, ...update.data };
          return {
            ...node,
            ...update,
            data: mergedData,
          };
        }
        return node;
      });

      // Add new nodes
      if (nodesToAdd.length > 0) {
        updatedNodes = [...updatedNodes, ...nodesToAdd];
      }

      return updatedNodes;
    });

    // Remove completed pending cards from context
    if (cardsToRemove.length > 0) {
      setTimeout(() => {
        cardsToRemove.forEach(id => removePendingCard(id));
      }, 0);
    }
  }, [pendingCards, setNodes, reactFlowInstance, removePendingCard]);

  const onContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const onPaneClick = useCallback(() => {
    setMenu(null);
  }, []);

  const addNode = useCallback((type: string) => {
    const position = menu
      ? reactFlowInstance.screenToFlowPosition({ x: menu.x, y: menu.y })
      : { x: 100, y: 100 };

    const newNode = createNode(type, position);
    setNodes((nds) => nds.concat(newNode));
    setMenu(null);
  }, [menu, reactFlowInstance, setNodes]);

  // Section counter for naming
  const sectionCounterRef = useRef(0);

  // Create section from selected nodes
  const createSection = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected && n.type !== "section");
    if (selectedNodes.length === 0) return;

    // Calculate bounding box of selected nodes (in absolute coordinates)
    // Handle nodes that may already be in a section (have parentId)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedNodes.forEach((node) => {
      // Get absolute position
      let absX = node.position.x;
      let absY = node.position.y;
      if (node.parentId) {
        const parentSection = nodes.find((n) => n.id === node.parentId);
        if (parentSection) {
          absX += parentSection.position.x;
          absY += parentSection.position.y;
        }
      }

      const nodeWidth = node.width || (node.data as { frameWidth?: number }).frameWidth || 300;
      const nodeHeight = node.height || (node.data as { frameHeight?: number }).frameHeight || 200;
      minX = Math.min(minX, absX);
      minY = Math.min(minY, absY);
      maxX = Math.max(maxX, absX + nodeWidth);
      maxY = Math.max(maxY, absY + nodeHeight);
    });

    // Section padding: 42px top, 20px left/right, 42px bottom
    const paddingTop = 42;
    const paddingLeft = 20;
    const paddingRight = 20;
    const paddingBottom = 42;
    const cardGap = 24;

    // Section position (based on original bounding box, offset by padding)
    const sectionX = minX - paddingLeft;
    const sectionY = minY - paddingTop;

    // Calculate arranged positions RELATIVE to section (for children)
    // Arrange horizontally with gaps
    let currentX = paddingLeft;
    const arrangedPositions: { id: string; x: number; y: number }[] = [];
    let maxCardHeight = 0;

    // Sort by current x position to maintain relative order
    const sortedNodes = [...selectedNodes].sort((a, b) => {
      // Get absolute positions for sorting
      let absXA = a.position.x;
      let absXB = b.position.x;
      if (a.parentId) {
        const parentA = nodes.find((n) => n.id === a.parentId);
        if (parentA) absXA += parentA.position.x;
      }
      if (b.parentId) {
        const parentB = nodes.find((n) => n.id === b.parentId);
        if (parentB) absXB += parentB.position.x;
      }
      return absXA - absXB;
    });

    sortedNodes.forEach((node) => {
      const nodeWidth = node.width || (node.data as { frameWidth?: number }).frameWidth || 300;
      const nodeHeight = node.height || (node.data as { frameHeight?: number }).frameHeight || 200;
      arrangedPositions.push({
        id: node.id,
        x: currentX,  // Relative to section
        y: paddingTop, // Relative to section
      });
      currentX += nodeWidth + cardGap;
      maxCardHeight = Math.max(maxCardHeight, nodeHeight);
    });

    // Section dimensions
    const sectionWidth = currentX - cardGap + paddingRight;
    const sectionHeight = paddingTop + maxCardHeight + paddingBottom;

    // Increment section counter
    sectionCounterRef.current += 1;
    const sectionName = `Section ${sectionCounterRef.current}`;
    const sectionId = `section-${Date.now()}`;

    // Create section node (must come BEFORE children in array for ReactFlow)
    const sectionNode: Node = {
      id: sectionId,
      type: "section",
      position: { x: sectionX, y: sectionY },
      data: {
        sectionName,
        frameWidth: sectionWidth,
        frameHeight: sectionHeight,
      },
      width: sectionWidth,
      height: sectionHeight,
      zIndex: -1, // Behind other nodes
      style: { zIndex: -1 },
    };

    // Update nodes: add section and make selected nodes children
    setNodes((nds) => {
      // First, add the section node
      const nodesWithSection = [sectionNode, ...nds];

      // Then update children to have parentId and relative positions
      return nodesWithSection.map((node) => {
        const arranged = arrangedPositions.find((p) => p.id === node.id);
        if (arranged) {
          return {
            ...node,
            parentId: sectionId, // Makes this node a child of the section
            position: {
              x: arranged.x,  // Position is now RELATIVE to parent
              y: arranged.y,
            },
            selected: false,
            className: "card-arranging",
            data: {
              ...node.data,
              parentSectionId: sectionId,
            },
          };
        }
        return node;
      });
    });

    // Remove animation class after animation completes
    setTimeout(() => {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          className: undefined,
        }))
      );
    }, 350);
  }, [nodes, setNodes]);

  // Handle node drag stop - check if nodes should be added to or removed from sections
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node, draggedNodes: Node[]) => {
      // Skip if dragging a section itself
      if (draggedNode.type === "section") return;

      // Get all section nodes
      const sections = nodes.filter((n) => n.type === "section");
      if (sections.length === 0) return;

      // For each dragged node, check if it's inside any section
      const updates: { nodeId: string; parentId: string | undefined; newPosition: { x: number; y: number } }[] = [];

      draggedNodes.forEach((node) => {
        if (node.type === "section") return;

        // Get the absolute position of the node
        // If node has a parent, its position is relative, need to convert to absolute
        let absoluteX = node.position.x;
        let absoluteY = node.position.y;

        if (node.parentId) {
          const parentSection = nodes.find((n) => n.id === node.parentId);
          if (parentSection) {
            absoluteX += parentSection.position.x;
            absoluteY += parentSection.position.y;
          }
        }

        const nodeWidth = node.width || (node.data as { frameWidth?: number }).frameWidth || 300;
        const nodeHeight = node.height || (node.data as { frameHeight?: number }).frameHeight || 200;

        // Use center point of node for section membership
        const nodeCenterX = absoluteX + nodeWidth / 2;
        const nodeCenterY = absoluteY + nodeHeight / 2;

        // Find which section (if any) contains the node's center
        let targetSection: Node | null = null;
        for (const section of sections) {
          const sectionWidth = section.width || (section.data as { frameWidth?: number }).frameWidth || 400;
          const sectionHeight = section.height || (section.data as { frameHeight?: number }).frameHeight || 300;

          const sectionLeft = section.position.x;
          const sectionTop = section.position.y;
          const sectionRight = section.position.x + sectionWidth;
          const sectionBottom = section.position.y + sectionHeight;

          // Check if node's center is inside section
          if (
            nodeCenterX >= sectionLeft &&
            nodeCenterX <= sectionRight &&
            nodeCenterY >= sectionTop &&
            nodeCenterY <= sectionBottom
          ) {
            targetSection = section;
            break;
          }
        }

        // Determine new parent and relative position
        if (targetSection) {
          // Node should be in this section
          if (node.parentId !== targetSection.id) {
            // Convert absolute position to relative to new parent
            const relativeX = absoluteX - targetSection.position.x;
            const relativeY = absoluteY - targetSection.position.y;
            updates.push({
              nodeId: node.id,
              parentId: targetSection.id,
              newPosition: { x: relativeX, y: relativeY },
            });
          }
        } else {
          // Node should NOT be in any section
          if (node.parentId) {
            // Convert relative position to absolute
            const parentSection = nodes.find((n) => n.id === node.parentId);
            if (parentSection) {
              const absolutePosX = node.position.x + parentSection.position.x;
              const absolutePosY = node.position.y + parentSection.position.y;
              updates.push({
                nodeId: node.id,
                parentId: undefined,
                newPosition: { x: absolutePosX, y: absolutePosY },
              });
            }
          }
        }
      });

      // Apply updates if any
      if (updates.length > 0) {
        setNodes((nds) =>
          nds.map((node) => {
            const update = updates.find((u) => u.nodeId === node.id);
            if (update) {
              return {
                ...node,
                parentId: update.parentId,
                position: update.newPosition,
                data: {
                  ...node.data,
                  parentSectionId: update.parentId,
                },
              };
            }
            return node;
          })
        );
      }
    },
    [nodes, setNodes]
  );

  // Handle double-click on sketch nodes
  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === "sketch") {
      setEditingSketchId(node.id);
      setIsSketchDrawerOpen(true);
    }
  }, []);

  const handleSketchDrawerOpenChange = useCallback((open: boolean) => {
    setIsSketchDrawerOpen(open);
    if (!open) {
      setEditingSketchId(null);
    }
  }, []);

  // Handle image pasting
  const handlePaste = useCallback((e: ClipboardEvent) => {
    // Check if we're in an input or textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            // Paste at current center of viewport
            const position = reactFlowInstance.screenToFlowPosition({
              x: window.innerWidth / 2,
              y: window.innerHeight / 2
            });
            const newNode = createNode("image", position);
            newNode.data = { ...newNode.data, url: dataUrl };
            setNodes((nds) => nds.concat(newNode));
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, [reactFlowInstance, setNodes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveActiveCanvas(nodes, edges).catch(err => {
          console.error("Failed to save canvas:", err);
        });
        return;
      }

      // 'S' to create section (not while editing text)
      if (e.key === 's' || e.key === 'S') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) {
          return;
        }
        e.preventDefault();
        createSection();
      }

      // 'C' to open AI mode (not while editing text)
      if (e.key === 'c' || e.key === 'C') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (!isAIMode) {
          setIsAIMode(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [createSection, setIsAIMode, isAIMode, handlePaste, saveActiveCanvas, nodes, edges]);

  // Track viewport changes for AI positioning - only update when movement ends (not continuously)
  const onMoveEnd = useCallback((event: any, viewport: { x: number; y: number; zoom: number }) => {
    setViewport(viewport, window.innerWidth, window.innerHeight);
  }, [setViewport]);

  const nodeDefinitions = getAllNodeDefinitions();

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        onContextMenu={onContextMenu}
        onPaneClick={onPaneClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStop={onNodeDragStop}
        onMoveEnd={onMoveEnd}
        selectionMode={SelectionMode.Partial}
        minZoom={0.01}
        maxZoom={10}
        panOnScroll={true}
        zoomOnScroll={false}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        panOnDrag={false}
        selectionOnDrag={true}
        proOptions={{ hideAttribution: true }}
      >
        {/* Background commented out like in ~/cardsboard */}
        {/* <Background color="#999999" gap={20} /> */}
        <Controls />

        {/* Canvas Navigator - Top Left */}
        <Panel position="top-left">
          <CanvasNavigator />
        </Panel>

        {/* Keyboard shortcut hint */}
        <Panel position="top-right" className="m-4">
          <div className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border border-gray-200 text-xs text-gray-500">
            <span className="font-semibold">Right-click</span> to add nodes ·
            <span className="font-semibold">S</span> for section ·
            <span className="font-semibold">C</span> for AI
          </div>
        </Panel>
      </ReactFlow>

      {/* Context Menu - matches ~/cardsboard style */}
      {menu && (
        <div
          className="fixed bg-white shadow-xl border border-zinc-200 rounded-lg py-1 z-50 min-w-[160px]"
          style={{ top: menu.y, left: menu.x }}
        >
          <div className="px-3 py-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Insert
          </div>
          {nodeDefinitions.map((def) => (
            <button
              key={def.type}
              onClick={() => addNode(def.type)}
              className="w-full text-left px-4 py-2 hover:bg-zinc-100 text-sm text-zinc-700 flex items-center gap-2"
            >
              {def.icon}
              <span>{def.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bottom Bar - has its own fixed positioning */}
      <BottomBar />

      {/* Sketch Edit Drawer */}
      <SketchNodeDrawer
        nodeId={editingSketchId || ""}
        open={isSketchDrawerOpen}
        onOpenChange={handleSketchDrawerOpenChange}
      />
    </div>
  );
}

export function OverviewCanvas() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-50">
      <ReactFlowProvider>
        <CanvasContent />
      </ReactFlowProvider>
    </div>
  );
}
