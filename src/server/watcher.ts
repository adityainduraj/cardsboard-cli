/**
 * Enhanced file watcher for HMR (Hot Module Replacement)
 * Watches generated component files and broadcasts updates via WebSocket
 */

import chokidar from "chokidar";
import path from "path";
import { WebSocketServer } from "ws";
import fs from "fs/promises";

export interface WatcherConfig {
  projectPath: string;
  generatedPath: string;
  wss: WebSocketServer;
}

export interface HMRMessage {
  type: 'generated:updated' | 'component:updated';
  file?: string;
  data?: any;
}

/**
 * Set up file watcher for HMR
 */
export function setupComponentWatcher(config: WatcherConfig): chokidar.FSWatcher {
  const { projectPath, generatedPath, wss } = config;

  // Watch both user's source AND generated files
  const watchPaths = [
    path.join(projectPath, 'src/**/*.{tsx,jsx,css,scss}'),
    path.join(generatedPath, '**/*.tsx'),
  ];

  const watcher = chokidar.watch(watchPaths, {
    ignored: /node_modules|\.next|\.git|dist/,
    persistent: true,
  });

  watcher.on('change', async (filePath) => {
    const relativePath = path.relative(projectPath, filePath);

    // Determine what type of file changed
    const isGenerated = filePath.includes(generatedPath);

    if (isGenerated) {
      // Generated component changed - trigger preview HMR
      broadcastGeneratedUpdate(wss, {
        type: 'generated:updated',
        file: relativePath,
      });
    } else {
      // Source component changed - could re-scan and broadcast
      // For now, just log it
      console.log('Source file changed:', relativePath);
    }
  });

  return watcher;
}

/**
 * Broadcast generated component update to all WebSocket clients
 */
function broadcastGeneratedUpdate(wss: WebSocketServer, message: HMRMessage): void {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(message));
    }
  });
}

/**
 * Broadcast component update to all WebSocket clients
 */
export function broadcastComponentUpdate(wss: WebSocketServer, message: HMRMessage): void {
  broadcastGeneratedUpdate(wss, message);
}
