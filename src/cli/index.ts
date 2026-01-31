import { Command } from "commander";
import express from "express";
import path from "path";
import { createServer } from "http";
import open from "open";
import { scanComponents } from "../scanner";
import { setupRoutes } from "../server/routes";
import { setupWebSocket } from "../server/websocket";
import chokidar from "chokidar";
import fs from "fs";
import { fileURLToPath } from "url";

// Get __dirname equivalent for both ESM and CJS
const getDirname = () => {
  try {
    // ESM - use import.meta.url
    const __filename = fileURLToPath(import.meta.url);
    return path.dirname(__filename);
  } catch {
    // CJS - use process.argv[1] to get the script path
    return path.dirname(process.argv[1]);
  }
};

const program = new Command();

program
  .name("cardsboard")
  .description("AI-powered design canvas for React projects")
  .version("0.1.0")
  .option("-p, --port <port>", "port to run on", "3001")
  .option("-c, --config <path>", "path to config file")
  .option("--no-open", "don't open browser automatically")
  .action(async (options) => {
    const port = parseInt(options.port);
    const projectPath = process.cwd();
    
    console.log("🎨 Cardsboard CLI v0.1.0");
    console.log(`📁 Project: ${projectPath}`);
    
    // Load config
    let config: any = {};
    const configPath = options.config || path.join(projectPath, ".cardsboardrc.json");
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        console.log(`⚙️  Config loaded from ${configPath}`);
      } catch (e) {
        console.warn(`⚠️  Failed to load config from ${configPath}`);
      }
    }
    
    // Create Express app
    const app = express();
    const server = createServer(app);
    
    // Middleware
    app.use(express.json());
    
    // Scan components
    console.log("🔍 Scanning for React components...");
    const scanPaths = config.scanPaths || ["src", "app", "components"];
    const components = await scanComponents(projectPath, scanPaths);
    console.log(`✅ Found ${components.length} components`);
    
    // Setup routes
    setupRoutes(app, components, projectPath, config);
    
    // Setup WebSocket for live reload
    const wss = setupWebSocket(server);
    
    // Setup file watcher
    const watchPaths = scanPaths.map((p: string) => path.join(projectPath, p, "**/*.{tsx,jsx,css,scss}"));
    const watcher = chokidar.watch(watchPaths, {
      ignored: /node_modules|\.next|\.git|dist/,
      persistent: true,
    });
    
    watcher.on("change", async (filePath) => {
      console.log(`📝 File changed: ${path.relative(projectPath, filePath)}`);
      // Re-scan components
      const updatedComponents = await scanComponents(projectPath, scanPaths);
      // Broadcast to all clients
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: "components:updated",
            data: updatedComponents,
          }));
        }
      });
    });
    
    // Serve static files (built canvas UI)
    // Try multiple possible locations for the canvas UI
    const possibleCanvasPaths = [
      // Canvas is sibling to cli.js (both in dist/)
      path.join(getDirname(), "canvas"),
      // When running from the package directory (dist/canvas)
      path.join(getDirname(), "..", "dist", "canvas"),
      // When running via npx from global install (npm may put things in lib/node_modules)
      path.join(getDirname(), "..", "..", "cardsboard-cli", "dist", "canvas"),
      path.join(getDirname(), "..", "lib", "node_modules", "cardsboard-cli", "dist", "canvas"),
      // When running from node_modules
      path.join(getDirname(), "..", "..", "..", "cardsboard-cli", "dist", "canvas"),
      // When running in development from project root
      path.join(projectPath, "dist", "canvas"),
    ];
    
    let canvasDistPath: string | null = null;
    for (const tryPath of possibleCanvasPaths) {
      if (fs.existsSync(tryPath)) {
        canvasDistPath = tryPath;
        break;
      }
    }
    
    if (canvasDistPath) {
      app.use(express.static(canvasDistPath));
      
      // Specific route for sketch editor
      app.get("/sketch-editor", (_req, res) => {
        res.sendFile(path.join(canvasDistPath!, "sketch-editor.html"));
      });
      
      // Catch-all route for SPA - must come after specific routes
      app.get("*", (_req, res) => {
        res.sendFile(path.join(canvasDistPath!, "index.html"));
      });
    } else {
      console.error("❌ Canvas UI not found. Tried:");
      possibleCanvasPaths.forEach(p => console.error("   -", p));
      console.error("\nRun: npm run build:canvas in the cardsboard-cli directory");
      process.exit(1);
    }
    
    // Start server
    server.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`\n🚀 Server ready at ${url}`);
      console.log("\nShortcuts:");
      console.log("  C - Open AI chat");
      console.log("  S - Create section from selection");
      console.log("  Cmd+S - Save canvas");
      console.log("\nPress Ctrl+C to stop\n");
      
      if (options.open) {
        open(url);
      }
    });
    
    // Graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n👋 Shutting down...");
      watcher.close();
      server.close(() => {
        process.exit(0);
      });
    });
  });

program.parse();
