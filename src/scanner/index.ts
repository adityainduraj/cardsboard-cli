import path from "path";
import fs from "fs";
import { glob } from "glob";

export interface ComponentInfo {
  name: string;
  filePath: string;
  relativePath: string;
  props?: string[];
  isDefaultExport?: boolean;
}

export async function scanComponents(
  projectPath: string,
  scanPaths: string[] = ["src", "app", "components"]
): Promise<ComponentInfo[]> {
  const components: ComponentInfo[] = [];
  
  // Find all .tsx and .jsx files in scan paths
  const patterns = scanPaths.map((scanPath) =>
    path.join(projectPath, scanPath, "**/*.{tsx,jsx}")
  );
  
  const files: string[] = [];
  for (const pattern of patterns) {
    try {
      const matches = await glob(pattern, {
        ignore: [
          "**/node_modules/**",
          "**/.next/**",
          "**/dist/**",
          "**/*.test.{tsx,jsx}",
          "**/*.spec.{tsx,jsx}",
          "**/*.stories.{tsx,jsx}",
        ],
      });
      files.push(...matches);
    } catch (e) {
      console.warn(`Failed to scan pattern: ${pattern}`);
    }
  }
  
  // Parse each file for exported components
  for (const filePath of files) {
    try {
      const source = fs.readFileSync(filePath, "utf-8");
      const fileComponents = parseComponentExports(source, filePath, projectPath);
      components.push(...fileComponents);
    } catch (e) {
      console.warn(`Failed to parse ${filePath}`);
    }
  }
  
  return components;
}

function parseComponentExports(
  source: string,
  filePath: string,
  projectPath: string
): ComponentInfo[] {
  const components: ComponentInfo[] = [];
  const relativePath = path.relative(projectPath, filePath);
  
  // Simple regex-based parsing (can be improved with proper AST parsing later)
  
  // Match export function ComponentName
  const functionExportRegex = /export\s+(?:default\s+)?(?:function|const)\s+(\w+)/g;
  let match;
  while ((match = functionExportRegex.exec(source)) !== null) {
    const name = match[1];
    // Filter out non-component names (hooks, utilities, etc.)
    if (isLikelyComponent(name, source)) {
      components.push({
        name,
        filePath,
        relativePath,
        isDefaultExport: match[0].includes("default"),
      });
    }
  }
  
  // Match export { ComponentName }
  const namedExportRegex = /export\s*\{([^}]+)\}/g;
  while ((match = namedExportRegex.exec(source)) !== null) {
    const exports = match[1].split(",").map((e) => e.trim().split("as")[0].trim());
    for (const name of exports) {
      if (isLikelyComponent(name, source)) {
        components.push({
          name,
          filePath,
          relativePath,
          isDefaultExport: false,
        });
      }
    }
  }
  
  return components;
}

function isLikelyComponent(name: string, source: string): boolean {
  // Heuristics to determine if an export is a React component
  
  // Must start with uppercase
  if (!/^[A-Z]/.test(name)) return false;
  
  // Common non-component patterns
  const nonComponents = [
    "Props",
    "State",
    "Config",
    "Options",
    "Params",
    "Query",
    "Mutation",
    "Schema",
    "Type",
    "Interface",
  ];
  if (nonComponents.some((suffix) => name.endsWith(suffix))) {
    return false;
  }
  
  // Check if the name appears with JSX-like usage in the file
  const jsxUsageRegex = new RegExp(`<${name}[\\s/>]`);
  if (jsxUsageRegex.test(source)) {
    return true;
  }
  
  // Check if it's defined with React.FC or similar
  const reactFcRegex = new RegExp(
    `${name}\\s*[:=].*React\\.FC|React\\.FunctionComponent`
  );
  if (reactFcRegex.test(source)) {
    return true;
  }
  
  // Check if it returns JSX
  const functionStart = source.indexOf(`function ${name}`);
  if (functionStart !== -1) {
    const nextFunction = source.indexOf("function ", functionStart + 1);
    const functionBody = source.slice(
      functionStart,
      nextFunction !== -1 ? nextFunction : undefined
    );
    if (/return\s*[<(]/.test(functionBody)) {
      return true;
    }
  }
  
  return true; // Default to including if it passes basic checks
}
