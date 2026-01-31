"use client"

import * as React from "react"
import { useReactFlow } from "@xyflow/react"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer"

// Dynamic import BlockNote to avoid SSR issues
const BlockNoteEditor = React.lazy(
  () => import("./BlockNoteEditorWrapper")
)

export interface TextNodeData {
  content?: string
  title?: string
}

// Extract first H1 from markdown content
function extractTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : null
}

interface TextNodeDrawerProps {
  nodeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TextNodeDrawer({ nodeId, open, onOpenChange }: TextNodeDrawerProps) {
  const { getNodes, setNodes } = useReactFlow()
  const [content, setContent] = React.useState("")

  // Load content when drawer opens
  React.useEffect(() => {
    if (open) {
      const node = getNodes().find((n) => n.id === nodeId)
      const nodeData = node?.data as TextNodeData
      setContent(nodeData?.content || "")
    }
  }, [open, nodeId, getNodes])

  const handleClose = React.useCallback(() => {
    const extractedTitle = extractTitle(content)

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const currentTitle = (node.data as TextNodeData).title
          const newTitle = extractedTitle || currentTitle || "Untitled"

          return { ...node, data: { ...node.data, content, title: newTitle } }
        }
        return node
      })
    )
    onOpenChange(false)
  }, [content, nodeId, setNodes, onOpenChange])

  const handleContentChange = React.useCallback((markdown: string) => {
    setContent(markdown)
  }, [])

  // Handle keyboard shortcuts
  React.useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        handleClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, handleClose])

  return (
    <Drawer open={open} onOpenChange={handleClose} shouldScaleBackground={true}>
      <DrawerContent
        className="flex flex-col"
        style={{ height: "calc(100% - 40px)", maxHeight: "calc(100% - 40px)" }}
        data-vaul-no-drag=""
      >
        <DrawerTitle className="sr-only">Edit Card</DrawerTitle>

        {/* Close Button - top right */}
        <div
          style={{
            position: "absolute",
            top: 24,
            right: 24,
            zIndex: 10,
          }}
        >
          <button
            onClick={handleClose}
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              backgroundColor: "#F9F9F9",
              border: "1px solid #F9F9F9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Handle */}
          <div
            aria-hidden
            className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mt-3 mb-2"
          />

          {/* Editor */}
          <div
            className="flex-1 overflow-auto px-6 py-4"
            style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', width: '100%' }}
          >
            <React.Suspense fallback={
              <div style={{ padding: 20, color: '#888' }}>Loading editor...</div>
            }>
              <BlockNoteEditor
                initialContent={content}
                onChange={handleContentChange}
              />
            </React.Suspense>
          </div>

          {/* Footer */}
          <div
            className="px-6 py-3 border-t border-zinc-100 flex items-center justify-between"
            style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', width: '100%' }}
          >
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 12, color: '#A0A0A0' }}>
              <kbd style={{ backgroundColor: '#F0F0F0', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>⌘S</kbd> to save
            </div>
            <button
              onClick={handleClose}
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 500,
                fontSize: 14,
                color: '#FFFFFF',
                backgroundColor: '#424242',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
