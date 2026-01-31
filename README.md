# Cardsboard CLI

AI-powered design canvas for React projects - local development tool.

## Installation

```bash
npm install -D cardsboard-cli
```

## Usage

```bash
npm run cardsboard
```

This will:
1. Start a local dev server on http://localhost:3001
2. Scan your project for React components
3. Open the canvas UI in your browser

## Features

- **Component Discovery**: Automatically finds and displays your React components
- **AI-Powered Design**: Generate designs using your actual components and design system
- **Live Updates**: Changes to your code reflect instantly on the canvas
- **Infinite Canvas**: Zoom, pan, and arrange designs freely
- **Export**: Copy generated code directly into your project

## Configuration

Create a `.cardsboardrc.json` file in your project root:

```json
{
  "port": 3001,
  "scanPaths": ["src/components", "app/components"],
  "exclude": ["**/*.test.tsx", "**/*.stories.tsx"],
  "ai": {
    "model": "google/gemini-2.5-flash",
    "apiKey": "env:OPENROUTER_API_KEY"
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev
```

## Project Structure

```
src/
├── canvas/          # React UI components
│   ├── components/  # Node components, shared utilities
│   └── nodes/       # Node types and registry
├── server/          # Express server
├── scanner/         # Component discovery
├── ai/              # AI integration
└── cli/             # CLI entry point
```

## License

MIT
