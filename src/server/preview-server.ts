/**
 * Preview server routes for React component rendering
 * Serves iframes with AI-generated React components
 */

import { Express } from "express";
import fs from "fs/promises";
import path from "path";

const GENERATED_DIR = path.join(".cardsboard", "generated");

/**
 * Generate the preview HTML for a component
 */
function generatePreviewHTML(componentId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview - ${componentId}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: system-ui, -apple-system, sans-serif; }
      #root { width: 100%; height: 100vh; overflow: auto; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/preview/${componentId}/entry.tsx"></script>
  </body>
</html>`;
}

/**
 * Generate the preview entry TypeScript code
 */
function generatePreviewEntryCode(component: any): string {
  // Generate a simple entry that renders the component
  return `import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Dynamically render the component
const componentCode = ${JSON.stringify(component.source)};

// Create a module from the source code (simplified approach)
// In production, this would use a proper module transpiler
function renderComponent() {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  // For now, render as an HTML preview
  // Full React component rendering requires proper module resolution
  rootEl.innerHTML = \`
    <div style="padding: 16px; font-family: system-ui;">
      <div style="color: #666; font-size: 12px; margin-bottom: 8px;">
        Preview: ${component.name}
      </div>
      <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; background: #f9f9f9;">
        <p style="color: #666;">React component preview</p>
        <p style="font-size: 12px; color: #999;">Component source: ${component.file}</p>
      </div>
    </div>
  \`;
}

renderComponent();

// Listen for prop updates
window.addEventListener('message', (event) => {
  if (event.data.type === 'updateProps') {
    renderComponent();
  }
});
`;
}

/**
 * Set up preview server routes
 */
export function setupPreviewRoutes(app: Express): void {
  /**
   * GET /preview/:componentId - Serves the preview iframe HTML
   */
  app.get("/preview/:componentId", async (req, res) => {
    const { componentId } = req.params;

    try {
      const registryPath = path.join(GENERATED_DIR, "registry.json");
      const registryContent = await fs.readFile(registryPath, "utf-8");
      const registry = JSON.parse(registryContent);
      const component = registry.components.find((c: any) => c.id === componentId);

      if (!component) {
        return res.status(404).send("Component not found");
      }

      // Send HTML with embedded entry point
      res.send(generatePreviewHTML(componentId));
    } catch (error) {
      console.error("Preview error:", error);
      res.status(500).send("Preview failed");
    }
  });

  /**
   * GET /preview/:componentId/entry.tsx - Serves the generated entry module
   */
  app.get("/preview/:componentId/entry.tsx", async (req, res) => {
    const { componentId } = req.params;

    try {
      const registryPath = path.join(GENERATED_DIR, "registry.json");
      const registryContent = await fs.readFile(registryPath, "utf-8");
      const registry = JSON.parse(registryContent);
      const component = registry.components.find((c: any) => c.id === componentId);

      if (!component) {
        return res.status(404).send("export default null;");
      }

      const entryCode = generatePreviewEntryCode(component);

      res.setHeader("Content-Type", "application/typescript; charset=utf-8");
      res.send(entryCode);
    } catch (error) {
      console.error("Preview entry error:", error);
      res.status(500).send("export default null;");
    }
  });

  /**
   * GET /preview/:componentId/source - Serves the component source directly
   */
  app.get("/preview/:componentId/source", async (req, res) => {
    const { componentId } = req.params;

    try {
      const registryPath = path.join(GENERATED_DIR, "registry.json");
      const registryContent = await fs.readFile(registryPath, "utf-8");
      const registry = JSON.parse(registryContent);
      const component = registry.components.find((c: any) => c.id === componentId);

      if (!component) {
        return res.status(404).json({ error: "Component not found" });
      }

      const filePath = path.join(GENERATED_DIR, component.file);
      const source = await fs.readFile(filePath, "utf-8");

      res.json({ source, name: component.name, file: component.file });
    } catch (error) {
      console.error("Preview source error:", error);
      res.status(500).json({ error: "Failed to load source" });
    }
  });

  /**
   * GET /preview/generated/* - Serve generated component files for import
   */
  app.get("/preview/generated/*", async (req, res) => {
    const filePath = req.params[0]; // Everything after /preview/generated/

    try {
      const fullPath = path.join(GENERATED_DIR, filePath);

      // Check if file exists
      await fs.access(fullPath);

      const source = await fs.readFile(fullPath, "utf-8");

      // Set content type based on extension
      const ext = path.extname(filePath);
      if (ext === ".tsx" || ext === ".ts") {
        res.setHeader("Content-Type", "application/typescript; charset=utf-8");
      } else if (ext === ".jsx" || ext === ".js") {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      }

      res.send(source);
    } catch (error) {
      console.error("Failed to serve generated file:", error);
      res.status(404).send("// File not found");
    }
  });
}
