/**
 * API routes for multi-canvas management
 * Handles CRUD operations for .cardsboard canvas files
 */

import { Express } from "express";
import fs from "fs/promises";
import path from "path";
import type {
  CardsboardFile,
  CanvasRegistry,
  CanvasRegistryEntry,
  createCanvasFile,
  canvasToFilename,
} from "../types/canvas-file";
import type { Node, Edge } from "@xyflow/react";

const CARDSBOARD_DIR = ".cardsboard";
const CANVASES_DIR = path.join(CARDSBOARD_DIR, "canvases");
const REGISTRY_FILE = path.join(CARDSBOARD_DIR, "canvases.json");
const LEGACY_CANVAS_FILE = path.join(CARDSBOARD_DIR, "canvas.json");

/**
 * Ensure the .cardsboard directory structure exists
 */
async function ensureCanvasStructure(): Promise<void> {
  const dirs = [CARDSBOARD_DIR, CANVASES_DIR];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (e) {
      // Ignore if already exists
    }
  }

  // Initialize registry if it doesn't exist
  try {
    await fs.access(REGISTRY_FILE);
  } catch {
    // Check if there's a legacy canvas.json to migrate
    let initialRegistry: CanvasRegistry = { activeCanvasId: null, canvases: [] };

    try {
      const legacyExists = await fs.access(LEGACY_CANVAS_FILE).then(() => true).catch(() => false);
      if (legacyExists) {
        // Migrate legacy canvas.json to new format
        const legacyContent = await fs.readFile(LEGACY_CANVAS_FILE, "utf-8");
        const legacyData = JSON.parse(legacyContent);

        const now = new Date().toISOString();
        const id = legacyData.id || `canvas-${Date.now()}`;
        const title = legacyData.title || "My Canvas";
        const filename = canvasToFilename(title);

        const newCanvas: CardsboardFile = {
          $schema: "https://cardsboard.app/schema/v1",
          version: "1.0",
          id,
          title,
          createdAt: legacyData.created_at || now,
          updatedAt: legacyData.updated_at || now,
          nodes: legacyData.nodes || [],
          edges: legacyData.edges || [],
        };

        // Write new canvas file
        await fs.writeFile(
          path.join(CANVASES_DIR, filename),
          JSON.stringify(newCanvas, null, 2)
        );

        // Initialize registry with migrated canvas
        initialRegistry = {
          activeCanvasId: id,
          canvases: [
            {
              id,
              title,
              file: filename,
              updatedAt: legacyData.updated_at || now,
            },
          ],
        };
      }
    } catch (e) {
      console.warn("Failed to migrate legacy canvas:", e);
    }

    await fs.writeFile(REGISTRY_FILE, JSON.stringify(initialRegistry, null, 2));
  }
}

/**
 * Read the canvas registry
 */
async function readRegistry(): Promise<CanvasRegistry> {
  try {
    const content = await fs.readFile(REGISTRY_FILE, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    return { activeCanvasId: null, canvases: [] };
  }
}

/**
 * Write the canvas registry
 */
async function writeRegistry(registry: CanvasRegistry): Promise<void> {
  await fs.writeFile(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

/**
 * Set up canvas management routes
 */
export function setupCanvasRoutes(app: Express, projectPath: string): void {
  const cardsboardDir = path.join(projectPath, CARDSBOARD_DIR);
  const canvasesDir = path.join(cardsboardDir, "canvases");

  // Initialize structure on startup
  ensureCanvasStructure().catch(console.error);

  /**
   * GET /api/canvases - List all canvases
   */
  app.get("/api/canvases", async (_req, res) => {
    try {
      await ensureCanvasStructure();
      const registry = await readRegistry();
      res.json(registry);
    } catch (error) {
      console.error("Failed to list canvases:", error);
      res.status(500).json({ error: "Failed to list canvases" });
    }
  });

  /**
   * GET /api/canvases/:id - Load a specific canvas
   */
  app.get("/api/canvases/:id", async (req, res) => {
    try {
      const registry = await readRegistry();
      const canvasEntry = registry.canvases.find((c) => c.id === req.params.id);

      if (!canvasEntry) {
        return res.status(404).json({ error: "Canvas not found" });
      }

      const canvasPath = path.join(canvasesDir, canvasEntry.file);
      const content = await fs.readFile(canvasPath, "utf-8");
      const canvas: CardsboardFile = JSON.parse(content);

      res.json(canvas);
    } catch (error) {
      console.error("Failed to load canvas:", error);
      res.status(500).json({ error: "Failed to load canvas" });
    }
  });

  /**
   * POST /api/canvases - Create a new canvas
   */
  app.post("/api/canvases", async (req, res) => {
    try {
      await ensureCanvasStructure();

      const { title } = req.body;
      if (!title || typeof title !== "string") {
        return res.status(400).json({ error: "Title is required" });
      }

      const registry = await readRegistry();
      const { createCanvasFile, canvasToFilename } = await import("../types/canvas-file");

      const newCanvas = createCanvasFile(title);
      const filename = canvasToFilename(title);

      // Ensure unique filename
      let finalFilename = filename;
      let counter = 1;
      while (registry.canvases.some((c) => c.file === finalFilename)) {
        const nameWithoutExt = title.replace(/\.cardsboard$/, "");
        finalFilename = `${nameWithoutExt}-${counter}.cardsboard`;
        counter++;
      }

      // Write canvas file
      const canvasPath = path.join(canvasesDir, finalFilename);
      await fs.writeFile(canvasPath, JSON.stringify(newCanvas, null, 2));

      // Update registry
      const newEntry: CanvasRegistryEntry = {
        id: newCanvas.id,
        title: newCanvas.title,
        file: finalFilename,
        updatedAt: newCanvas.updatedAt,
      };

      registry.canvases.push(newEntry);
      registry.activeCanvasId = newCanvas.id;
      await writeRegistry(registry);

      res.json(newCanvas);
    } catch (error) {
      console.error("Failed to create canvas:", error);
      res.status(500).json({ error: "Failed to create canvas" });
    }
  });

  /**
   * PUT /api/canvases/:id - Update a canvas
   */
  app.put("/api/canvases/:id", async (req, res) => {
    try {
      const { nodes, edges, title } = req.body;
      const registry = await readRegistry();
      const canvasEntry = registry.canvases.find((c) => c.id === req.params.id);

      if (!canvasEntry) {
        return res.status(404).json({ error: "Canvas not found" });
      }

      const canvasPath = path.join(canvasesDir, canvasEntry.file);
      const content = await fs.readFile(canvasPath, "utf-8");
      const canvas: CardsboardFile = JSON.parse(content);

      // Update fields
      if (nodes !== undefined) canvas.nodes = nodes;
      if (edges !== undefined) canvas.edges = edges;
      if (title !== undefined) {
        canvas.title = title;
        canvasEntry.title = title;
      }
      canvas.updatedAt = new Date().toISOString();
      canvasEntry.updatedAt = canvas.updatedAt;

      // Write updated canvas
      await fs.writeFile(canvasPath, JSON.stringify(canvas, null, 2));
      await writeRegistry(registry);

      res.json(canvas);
    } catch (error) {
      console.error("Failed to update canvas:", error);
      res.status(500).json({ error: "Failed to update canvas" });
    }
  });

  /**
   * DELETE /api/canvases/:id - Delete a canvas
   */
  app.delete("/api/canvases/:id", async (req, res) => {
    try {
      const registry = await readRegistry();
      const canvasIndex = registry.canvases.findIndex((c) => c.id === req.params.id);

      if (canvasIndex === -1) {
        return res.status(404).json({ error: "Canvas not found" });
      }

      const canvasEntry = registry.canvases[canvasIndex];
      const canvasPath = path.join(canvasesDir, canvasEntry.file);

      // Delete the file
      await fs.unlink(canvasPath);

      // Remove from registry
      registry.canvases.splice(canvasIndex, 1);

      // Set new active canvas if we deleted the active one
      if (registry.activeCanvasId === req.params.id) {
        registry.activeCanvasId = registry.canvases.length > 0 ? registry.canvases[0].id : null;
      }

      await writeRegistry(registry);

      res.json({ success: true, activeCanvasId: registry.activeCanvasId });
    } catch (error) {
      console.error("Failed to delete canvas:", error);
      res.status(500).json({ error: "Failed to delete canvas" });
    }
  });

  /**
   * POST /api/canvases/:id/switch - Switch to a different canvas (returns the canvas data)
   */
  app.post("/api/canvases/:id/switch", async (req, res) => {
    try {
      const registry = await readRegistry();
      const canvasEntry = registry.canvases.find((c) => c.id === req.params.id);

      if (!canvasEntry) {
        return res.status(404).json({ error: "Canvas not found" });
      }

      // Update active canvas
      registry.activeCanvasId = req.params.id;
      await writeRegistry(registry);

      // Load and return the canvas data
      const canvasPath = path.join(canvasesDir, canvasEntry.file);
      const content = await fs.readFile(canvasPath, "utf-8");
      const canvas: CardsboardFile = JSON.parse(content);

      res.json(canvas);
    } catch (error) {
      console.error("Failed to switch canvas:", error);
      res.status(500).json({ error: "Failed to switch canvas" });
    }
  });

  /**
   * GET /api/canvas/active - Get the currently active canvas
   * (Convenience endpoint that mirrors the old /api/canvas behavior)
   */
  app.get("/api/canvas/active", async (req, res) => {
    try {
      await ensureCanvasStructure();
      const registry = await readRegistry();

      // If no active canvas, return empty state
      if (!registry.activeCanvasId) {
        return res.json({ nodes: [], edges: [], title: "My Canvas" });
      }

      const canvasEntry = registry.canvases.find((c) => c.id === registry.activeCanvasId);
      if (!canvasEntry) {
        return res.json({ nodes: [], edges: [], title: "My Canvas" });
      }

      const canvasPath = path.join(canvasesDir, canvasEntry.file);
      const content = await fs.readFile(canvasPath, "utf-8");
      const canvas: CardsboardFile = JSON.parse(content);

      res.json(canvas);
    } catch (error) {
      console.error("Failed to load active canvas:", error);
      res.status(500).json({ error: "Failed to load canvas" });
    }
  });

  /**
   * POST /api/canvas/active - Save the current active canvas
   * (Convenience endpoint that mirrors the old /api/canvas behavior)
   */
  app.post("/api/canvas/active", async (req, res) => {
    try {
      await ensureCanvasStructure();
      const { nodes, edges, title, id } = req.body;

      const registry = await readRegistry();

      // If an id is provided, try to update that canvas
      // Otherwise, use the active canvas or create a new one
      let canvasId = id || registry.activeCanvasId;
      let canvasEntry: CanvasRegistryEntry | undefined;

      if (canvasId) {
        canvasEntry = registry.canvases.find((c) => c.id === canvasId);
      }

      // Create new canvas if needed
      if (!canvasEntry) {
        const { createCanvasFile, canvasToFilename } = await import("../types/canvas-file");

        const newCanvas = createCanvasFile(title || "Untitled Canvas");
        const filename = canvasToFilename(newCanvas.title);

        // Ensure unique filename
        let finalFilename = filename;
        let counter = 1;
        while (registry.canvases.some((c) => c.file === finalFilename)) {
          finalFilename = `untitled-${counter}.cardsboard`;
          counter++;
        }

        // Write canvas file
        const canvasPath = path.join(canvasesDir, finalFilename);
        await fs.writeFile(canvasPath, JSON.stringify(newCanvas, null, 2));

        // Add to registry
        canvasEntry = {
          id: newCanvas.id,
          title: newCanvas.title,
          file: finalFilename,
          updatedAt: newCanvas.updatedAt,
        };

        registry.canvases.push(canvasEntry);
        canvasId = newCanvas.id;
      }

      // Update canvas
      const canvasPath = path.join(canvasesDir, canvasEntry.file);
      const content = await fs.readFile(canvasPath, "utf-8");
      const canvas: CardsboardFile = JSON.parse(content);

      canvas.nodes = nodes || [];
      canvas.edges = edges || [];
      if (title) canvas.title = title;
      canvas.updatedAt = new Date().toISOString();
      canvasEntry.title = canvas.title;
      canvasEntry.updatedAt = canvas.updatedAt;

      await fs.writeFile(canvasPath, JSON.stringify(canvas, null, 2));

      // Set as active if not already
      if (registry.activeCanvasId !== canvasId) {
        registry.activeCanvasId = canvasId;
      }
      await writeRegistry(registry);

      res.json({ success: true, id: canvasId, canvas });
    } catch (error) {
      console.error("Failed to save canvas:", error);
      res.status(500).json({ error: "Failed to save canvas" });
    }
  });
}
