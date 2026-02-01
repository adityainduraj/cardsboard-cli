/**
 * Hook for managing multiple canvases
 * Handles CRUD operations and switching between canvases.
 * Must be used within CanvasesProvider so state is shared (navigator + canvas view).
 */

export { useCanvasesContext as useCanvases } from "@/context/canvases/CanvasesContext"
export type { UseCanvasesReturn } from "@/context/canvases/CanvasesContext"
