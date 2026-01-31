/**
 * API routes for .cardsboard folder structure management
 * Handles generated components, assets, and guides
 */

import { Express } from "express";
import fs from "fs/promises";
import path from "path";
import type {
  GeneratedComponent,
  GeneratedRegistry,
  AssetImage,
  AssetRegistry,
  DesignSystemGuide,
  GuideRegistry,
} from "../types/cardsboard-structure";

const CARDSBOARD_DIR = ".cardsboard";
const GENERATED_DIR = path.join(CARDSBOARD_DIR, "generated");
const ASSETS_DIR = path.join(CARDSBOARD_DIR, "assets");
const GUIDES_DIR = path.join(CARDSBOARD_DIR, "guides");

/**
 * Ensure the .cardsboard directory structure exists
 */
async function ensureCardsboardStructure(): Promise<void> {
  const dirs = [
    CARDSBOARD_DIR,
    GENERATED_DIR,
    path.join(GENERATED_DIR, "components"),
    path.join(GENERATED_DIR, "variants"),
    path.join(ASSETS_DIR, "images"),
    path.join(ASSETS_DIR, "thumbnails"),
    GUIDES_DIR,
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (e) {
      // Ignore if already exists
    }
  }

  // Initialize registries if they don't exist
  const registries = [
    { path: path.join(GENERATED_DIR, "registry.json"), initial: { components: [], variants: {}, lastUpdated: new Date().toISOString() } as GeneratedRegistry },
    { path: path.join(ASSETS_DIR, "registry.json"), initial: { images: [], lastUpdated: new Date().toISOString() } as AssetRegistry },
    { path: path.join(GUIDES_DIR, "registry.json"), initial: { designSystems: [], componentCatalogs: [], lastUpdated: new Date().toISOString() } as GuideRegistry },
  ];

  for (const { path: regPath, initial } of registries) {
    try {
      await fs.access(regPath);
    } catch {
      await fs.writeFile(regPath, JSON.stringify(initial, null, 2));
    }
  }
}

/**
 * Read the generated component registry
 */
async function readGeneratedRegistry(): Promise<GeneratedRegistry> {
  try {
    const content = await fs.readFile(path.join(GENERATED_DIR, "registry.json"), "utf-8");
    return JSON.parse(content);
  } catch (e) {
    return { components: [], variants: {}, lastUpdated: new Date().toISOString() };
  }
}

/**
 * Write the generated component registry
 */
async function writeGeneratedRegistry(registry: GeneratedRegistry): Promise<void> {
  registry.lastUpdated = new Date().toISOString();
  await fs.writeFile(
    path.join(GENERATED_DIR, "registry.json"),
    JSON.stringify(registry, null, 2)
  );
}

/**
 * Read the asset registry
 */
async function readAssetRegistry(): Promise<AssetRegistry> {
  try {
    const content = await fs.readFile(path.join(ASSETS_DIR, "registry.json"), "utf-8");
    return JSON.parse(content);
  } catch (e) {
    return { images: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * Write the asset registry
 */
async function writeAssetRegistry(registry: AssetRegistry): Promise<void> {
  registry.lastUpdated = new Date().toISOString();
  await fs.writeFile(
    path.join(ASSETS_DIR, "registry.json"),
    JSON.stringify(registry, null, 2)
  );
}

/**
 * Read the guide registry
 */
async function readGuideRegistry(): Promise<GuideRegistry> {
  try {
    const content = await fs.readFile(path.join(GUIDES_DIR, "registry.json"), "utf-8");
    return JSON.parse(content);
  } catch (e) {
    return { designSystems: [], componentCatalogs: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * Write the guide registry
 */
async function writeGuideRegistry(registry: GuideRegistry): Promise<void> {
  registry.lastUpdated = new Date().toISOString();
  await fs.writeFile(
    path.join(GUIDES_DIR, "registry.json"),
    JSON.stringify(registry, null, 2)
  );
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Convert string to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Generate a hash from a string
 */
function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Set up .cardsboard folder structure routes
 */
export function setupCardsboardRoutes(app: Express): void {
  // Initialize structure on startup
  ensureCardsboardStructure().catch(console.error);

  /**
   * GET /api/cardsboard/structure - Get the complete folder structure
   */
  app.get("/api/cardsboard/structure", async (_req, res) => {
    try {
      await ensureCardsboardStructure();
      const generatedRegistry = await readGeneratedRegistry();
      const assetRegistry = await readAssetRegistry();
      const guideRegistry = await readGuideRegistry();

      res.json({
        generated: generatedRegistry,
        assets: assetRegistry,
        guides: guideRegistry,
      });
    } catch (error) {
      console.error("Failed to read structure:", error);
      res.status(500).json({ error: "Failed to read structure" });
    }
  });

  // ========================================
  // Generated Components
  // ========================================

  /**
   * GET /api/cardsboard/generated - List all generated components
   */
  app.get("/api/cardsboard/generated", async (_req, res) => {
    try {
      const registry = await readGeneratedRegistry();
      res.json(registry);
    } catch (error) {
      console.error("Failed to list generated components:", error);
      res.status(500).json({ error: "Failed to list components" });
    }
  });

  /**
   * GET /api/cardsboard/generated/:id - Get a specific generated component
   */
  app.get("/api/cardsboard/generated/:id", async (req, res) => {
    try {
      const registry = await readGeneratedRegistry();
      const component = registry.components.find((c) => c.id === req.params.id);

      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }

      const filePath = path.join(GENERATED_DIR, component.file);
      const source = await fs.readFile(filePath, "utf-8");

      res.json({ ...component, source });
    } catch (error) {
      console.error("Failed to read component:", error);
      res.status(500).json({ error: "Failed to read component" });
    }
  });

  /**
   * POST /api/cardsboard/generated - Create a new generated component
   */
  app.post("/api/cardsboard/generated", async (req, res) => {
    try {
      const { nodeId, name, source, prompt, model } = req.body;

      if (!name || !source) {
        return res.status(400).json({ error: "Name and source are required" });
      }

      const componentId = generateId();
      const fileName = `${toKebabCase(name)}.tsx`;
      const filePath = path.join(GENERATED_DIR, "components", fileName);

      // Write the component file
      await fs.writeFile(filePath, source, "utf-8");

      // Create component entry
      const component: GeneratedComponent = {
        id: componentId,
        nodeId,
        name,
        file: `components/${fileName}`,
        source,
        previewUrl: `/preview/${componentId}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          prompt,
          model,
        },
      };

      // Update registry
      const registry = await readGeneratedRegistry();
      registry.components.push(component);
      await writeGeneratedRegistry(registry);

      res.json({ success: true, componentId, component });
    } catch (error) {
      console.error("Failed to create component:", error);
      res.status(500).json({ error: "Failed to create component" });
    }
  });

  /**
   * PUT /api/cardsboard/generated/:id - Update a generated component
   */
  app.put("/api/cardsboard/generated/:id", async (req, res) => {
    try {
      const { source, name } = req.body;
      const registry = await readGeneratedRegistry();
      const component = registry.components.find((c) => c.id === req.params.id);

      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }

      const filePath = path.join(GENERATED_DIR, component.file);

      // Update source if provided
      if (source !== undefined) {
        await fs.writeFile(filePath, source, "utf-8");
        component.source = source;
      }

      // Update name if provided (requires file rename)
      if (name && name !== component.name) {
        const oldFileName = path.basename(component.file);
        const newFileName = `${toKebabCase(name)}.tsx`;
        const oldPath = path.join(GENERATED_DIR, component.file);
        const newPath = path.join(GENERATED_DIR, "components", newFileName);

        await fs.rename(oldPath, newPath);
        component.name = name;
        component.file = `components/${newFileName}`;
      }

      component.updatedAt = new Date().toISOString();
      await writeGeneratedRegistry(registry);

      res.json({ success: true, component });
    } catch (error) {
      console.error("Failed to update component:", error);
      res.status(500).json({ error: "Failed to update component" });
    }
  });

  /**
   * DELETE /api/cardsboard/generated/:id - Delete a generated component
   */
  app.delete("/api/cardsboard/generated/:id", async (req, res) => {
    try {
      const registry = await readGeneratedRegistry();
      const componentIndex = registry.components.findIndex((c) => c.id === req.params.id);

      if (componentIndex === -1) {
        return res.status(404).json({ error: "Component not found" });
      }

      const component = registry.components[componentIndex];
      const filePath = path.join(GENERATED_DIR, component.file);

      // Delete the file
      await fs.unlink(filePath);

      // Remove from registry
      registry.components.splice(componentIndex, 1);
      await writeGeneratedRegistry(registry);

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete component:", error);
      res.status(500).json({ error: "Failed to delete component" });
    }
  });

  // ========================================
  // Assets
  // ========================================

  /**
   * GET /api/cardsboard/assets - List all assets
   */
  app.get("/api/cardsboard/assets", async (_req, res) => {
    try {
      const registry = await readAssetRegistry();
      res.json(registry);
    } catch (error) {
      console.error("Failed to list assets:", error);
      res.status(500).json({ error: "Failed to list assets" });
    }
  });

  /**
   * POST /api/cardsboard/assets - Upload an asset (image)
   */
  app.post("/api/cardsboard/assets", async (req, res) => {
    try {
      const { nodeId, dataUrl, mimeType = "image/png", originalName = "image" } = req.body;

      if (!dataUrl) {
        return res.status(400).json({ error: "dataUrl is required" });
      }

      // Parse data URL
      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: "Invalid data URL format" });
      }

      const mimeTypeActual = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");

      // Generate filename
      const timestamp = Date.now();
      const hash = generateHash(dataUrl);
      const extension = mimeTypeActual === "image/jpeg" || mimeTypeActual === "image/jpg" ? "jpg" : "png";
      const fileName = `uploaded-${timestamp}-${hash}.${extension}`;

      // Save image file
      const filePath = path.join(ASSETS_DIR, "images", fileName);
      await fs.writeFile(filePath, buffer);

      // Create thumbnail (just copy the original for now - could use sharp for proper thumbnails)
      const thumbnailFileName = `${nodeId || "asset"}-${timestamp}.png`;
      const thumbnailPath = path.join(ASSETS_DIR, "thumbnails", thumbnailFileName);
      await fs.writeFile(thumbnailPath, buffer);

      // Create asset entry
      const asset: AssetImage = {
        id: generateId(),
        nodeId,
        originalName,
        file: `images/${fileName}`,
        thumbnail: `thumbnails/${thumbnailFileName}`,
        mimeType: mimeTypeActual,
        size: buffer.length,
        hash,
        createdAt: new Date().toISOString(),
      };

      // Update registry
      const registry = await readAssetRegistry();
      registry.images.push(asset);
      await writeAssetRegistry(registry);

      res.json({
        success: true,
        asset,
        url: `/api/cardsboard/assets/images/${fileName}`,
      });
    } catch (error) {
      console.error("Failed to save asset:", error);
      res.status(500).json({ error: "Failed to save asset" });
    }
  });

  /**
   * GET /api/cardsboard/assets/images/:filename - Serve an asset image
   */
  app.get("/api/cardsboard/assets/images/:filename", async (req, res) => {
    try {
      const filePath = path.join(ASSETS_DIR, "images", req.params.filename);
      const data = await fs.readFile(filePath);

      // Determine content type from extension
      const ext = path.extname(req.params.filename);
      const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

      res.setHeader("Content-Type", contentType);
      res.send(data);
    } catch (error) {
      console.error("Failed to serve asset:", error);
      res.status(404).json({ error: "Asset not found" });
    }
  });

  /**
   * GET /api/cardsboard/assets/thumbnails/:filename - Serve a thumbnail
   */
  app.get("/api/cardsboard/assets/thumbnails/:filename", async (req, res) => {
    try {
      const filePath = path.join(ASSETS_DIR, "thumbnails", req.params.filename);
      const data = await fs.readFile(filePath);

      res.setHeader("Content-Type", "image/png");
      res.send(data);
    } catch (error) {
      console.error("Failed to serve thumbnail:", error);
      res.status(404).json({ error: "Thumbnail not found" });
    }
  });

  // ========================================
  // Guides
  // ========================================

  /**
   * GET /api/cardsboard/guides - List all guides
   */
  app.get("/api/cardsboard/guides", async (_req, res) => {
    try {
      const registry = await readGuideRegistry();
      res.json(registry);
    } catch (error) {
      console.error("Failed to list guides:", error);
      res.status(500).json({ error: "Failed to list guides" });
    }
  });

  /**
   * POST /api/cardsboard/guides - Create or update a guide
   */
  app.post("/api/cardsboard/guides", async (req, res) => {
    try {
      const { id, name, type, content } = req.body;

      if (!name || !content || !type) {
        return res.status(400).json({ error: "name, type, and content are required" });
      }

      if (type !== "design-system" && type !== "component-catalog") {
        return res.status(400).json({ error: "type must be 'design-system' or 'component-catalog'" });
      }

      const fileName = `${toKebabCase(name)}.json`;
      const filePath = path.join(GUIDES_DIR, fileName);

      await fs.writeFile(filePath, JSON.stringify(content, null, 2), "utf-8");

      const guideId = id || generateId();
      const now = new Date().toISOString();

      const registry = await readGuideRegistry();

      if (type === "design-system") {
        const guide: DesignSystemGuide = {
          id: guideId,
          name,
          file: fileName,
          content,
          createdAt: now,
          updatedAt: now,
        };

        const existingIndex = registry.designSystems.findIndex((g) => g.id === guideId);
        if (existingIndex >= 0) {
          registry.designSystems[existingIndex] = { ...registry.designSystems[existingIndex], ...guide };
        } else {
          registry.designSystems.push(guide);
        }
      } else {
        // component-catalog
        const catalog = {
          id: guideId,
          name,
          file: fileName,
          components: content.components || [],
          createdAt: now,
          updatedAt: now,
        };

        const existingIndex = registry.componentCatalogs.findIndex((c) => c.id === guideId);
        if (existingIndex >= 0) {
          registry.componentCatalogs[existingIndex] = { ...registry.componentCatalogs[existingIndex], ...catalog };
        } else {
          registry.componentCatalogs.push(catalog as any);
        }
      }

      await writeGuideRegistry(registry);

      res.json({ success: true, id: guideId });
    } catch (error) {
      console.error("Failed to save guide:", error);
      res.status(500).json({ error: "Failed to save guide" });
    }
  });

  /**
   * GET /api/cardsboard/guides/:id - Get a specific guide
   */
  app.get("/api/cardsboard/guides/:id", async (req, res) => {
    try {
      const registry = await readGuideRegistry();

      // Check design systems
      const designSystem = registry.designSystems.find((g) => g.id === req.params.id);
      if (designSystem) {
        const filePath = path.join(GUIDES_DIR, designSystem.file);
        const content = await fs.readFile(filePath, "utf-8");
        return res.json({ type: "design-system", ...designSystem, content: JSON.parse(content) });
      }

      // Check component catalogs
      const catalog = registry.componentCatalogs.find((c) => c.id === req.params.id);
      if (catalog) {
        const filePath = path.join(GUIDES_DIR, catalog.file);
        const content = await fs.readFile(filePath, "utf-8");
        return res.json({ type: "component-catalog", ...catalog, content: JSON.parse(content) });
      }

      return res.status(404).json({ error: "Guide not found" });
    } catch (error) {
      console.error("Failed to read guide:", error);
      res.status(500).json({ error: "Failed to read guide" });
    }
  });

  /**
   * DELETE /api/cardsboard/guides/:id - Delete a guide
   */
  app.delete("/api/cardsboard/guides/:id", async (req, res) => {
    try {
      const registry = await readGuideRegistry();

      // Check design systems
      const dsIndex = registry.designSystems.findIndex((g) => g.id === req.params.id);
      if (dsIndex >= 0) {
        const guide = registry.designSystems[dsIndex];
        const filePath = path.join(GUIDES_DIR, guide.file);
        await fs.unlink(filePath);
        registry.designSystems.splice(dsIndex, 1);
        await writeGuideRegistry(registry);
        return res.json({ success: true });
      }

      // Check component catalogs
      const catIndex = registry.componentCatalogs.findIndex((c) => c.id === req.params.id);
      if (catIndex >= 0) {
        const catalog = registry.componentCatalogs[catIndex];
        const filePath = path.join(GUIDES_DIR, catalog.file);
        await fs.unlink(filePath);
        registry.componentCatalogs.splice(catIndex, 1);
        await writeGuideRegistry(registry);
        return res.json({ success: true });
      }

      return res.status(404).json({ error: "Guide not found" });
    } catch (error) {
      console.error("Failed to delete guide:", error);
      res.status(500).json({ error: "Failed to delete guide" });
    }
  });
}
