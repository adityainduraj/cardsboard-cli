"use client"

import * as React from "react"
import { BlockNoteView } from "@blocknote/mantine"
import { useCreateBlockNote } from "@blocknote/react"
import "@blocknote/mantine/style.css"

interface BlockNoteEditorWrapperProps {
  initialContent: string
  onChange: (markdown: string) => void
}

export default function BlockNoteEditorWrapper({ initialContent, onChange }: BlockNoteEditorWrapperProps) {
  const [mounted, setMounted] = React.useState(false)

  const editor = useCreateBlockNote({
    initialContent: undefined,
  })

  React.useEffect(() => {
    if (editor && initialContent && !mounted) {
      const loadContent = async () => {
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(initialContent)
          editor.replaceBlocks(editor.document, blocks)
        } catch (e) {
          console.error("Failed to parse markdown:", e)
        }
        setMounted(true)
      }
      loadContent()
    } else if (!initialContent) {
      setMounted(true)
    }
  }, [editor, initialContent, mounted])

  const handleChange = React.useCallback(async () => {
    if (editor && mounted) {
      try {
        const markdown = await editor.blocksToMarkdownLossy(editor.document)
        onChange(markdown)
      } catch (e) {
        console.error("Failed to convert to markdown:", e)
      }
    }
  }, [editor, mounted, onChange])

  return (
    <div style={{ minHeight: 400 }}>
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        theme="light"
      />
    </div>
  )
}
