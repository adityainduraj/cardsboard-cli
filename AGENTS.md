# AGENTS.md - Cardsboard CLI

## Project Overview
Cardsboard CLI is an AI-powered design canvas for React projects. It runs locally and provides an infinite canvas interface for exploring React components with AI assistance.

## Build Commands

```bash
# Build everything (server + canvas)
npm run build

# Build server only (Node.js/Express)
npm run build:server

# Build canvas only (React/Vite)
npm run build:canvas

# Development mode - server with hot reload
npm run dev

# Development mode - canvas only
npm run dev:canvas
```

## Test Commands

```bash
# Run all tests
npm run test

# Run specific test file
npx vitest run src/path/to/test.test.ts

# Run tests in watch mode
npx vitest

# Run with coverage
npx vitest run --coverage
```

## Lint & Type Check

```bash
# Run ESLint
npm run lint

# Run TypeScript type checking
npm run typecheck

# Fix ESLint issues
npx eslint src --ext .ts,.tsx --fix
```

## Code Style Guidelines

### TypeScript
- Use strict TypeScript settings (enabled in tsconfig.json)
- Always define explicit return types for exported functions
- Use `interface` for object shapes, `type` for unions/aliases
- Avoid `any` - use `unknown` with type guards instead
- Enable `noUnusedLocals` and `noUnusedParameters` - clean up unused code

### Imports
- Group imports: 1) external libs, 2) internal modules, 3) types
- Use path aliases: `@/` for src, `@canvas/` for canvas, `@server/` for server
- Import React as `import * as React from "react"` (not default import)
- Use named imports for specific React hooks: `import { useState } from "react"`

### Naming Conventions
- Components: PascalCase (e.g., `DesignNode.tsx`)
- Functions/variables: camelCase (e.g., `scanComponents`)
- Constants: UPPER_SNAKE_CASE for true constants
- Interfaces: PascalCase with descriptive names (e.g., `ComponentInfo`)
- Files: PascalCase for components, camelCase for utilities

### Error Handling
- Always handle errors in async functions with try/catch
- Use specific error types, avoid generic `Error` when possible
- Log errors with context: `console.error("Failed to scan:", error)`
- Return early on errors to avoid nested conditionals
- For HTTP routes, always send appropriate status codes

### React Components
- Use functional components with hooks
- Props interfaces should be exported
- Destructure props in function parameters when possible
- Use `React.lazy()` for code splitting heavy components
- Keep components under 200 lines - split into smaller components

### Formatting
- Use 2 spaces for indentation
- Max line length: 100 characters
- Use trailing commas in multi-line objects/arrays
- No semicolons (project uses ASI)
- Use single quotes for strings

### Project Structure
```
src/
├── cli/          # CLI entry point
├── server/       # Express server, routes, WebSocket
├── scanner/      # Component discovery logic
├── canvas/       # React UI (built separately with Vite)
│   ├── components/
│   ├── nodes/    # Node types and registry
│   └── lib/      # Canvas utilities
└── utils/        # Shared utilities
```

### Key Patterns
- Server code uses CommonJS-compatible ESM (tsup builds both)
- Canvas uses Vite for bundling (ESM only)
- WebSocket for live reload between server and canvas
- File-based storage in `.cardsboard/` directory
- No database - everything is local files

### Testing
- Use vitest for testing
- Place tests in `__tests__/` directory or co-locate as `.test.ts`
- Mock external dependencies (fs, network)
- Test both success and error paths

### Git
- Commit messages: present tense, descriptive (e.g., "Add component scanner")
- Don't commit dist/ or node_modules/
- Keep commits focused on single changes

## Important Notes
- Canvas UI is excluded from TypeScript checking (see tsconfig.json exclude)
- The CLI must be built before testing (`npm run build`)
- Canvas and server are built separately with different tools
- Always check both server and canvas build successfully
