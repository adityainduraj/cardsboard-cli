/**
 * CanvasNavigator - Top-left canvas switcher
 * Allows creating, switching, renaming, and deleting canvases
 */

import { useState, useRef, useEffect } from "react";
import { useCanvases } from "@/hooks/useCanvases";

export function CanvasNavigator() {
  const {
    canvases,
    activeCanvasId,
    createCanvas,
    switchCanvas,
    deleteCanvas,
    renameCanvas,
    isLoading,
  } = useCanvases();

  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [newCanvasTitle, setNewCanvasTitle] = useState("");
  const [showNewCanvasInput, setShowNewCanvasInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowNewCanvasInput(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when shown
  useEffect(() => {
    if (showNewCanvasInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewCanvasInput]);

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId);

  const handleSwitch = async (id: string) => {
    await switchCanvas(id);
    setIsOpen(false);
  };

  const handleCreate = async () => {
    if (!newCanvasTitle.trim()) return;

    try {
      await createCanvas(newCanvasTitle.trim());
      setNewCanvasTitle("");
      setShowNewCanvasInput(false);
    } catch (err) {
      console.error("Failed to create canvas:", err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (canvases.length === 1) {
      alert("Cannot delete the last canvas");
      return;
    }

    if (confirm(`Delete "${canvases.find((c) => c.id === id)?.title}"?`)) {
      try {
        await deleteCanvas(id);
      } catch (err) {
        console.error("Failed to delete canvas:", err);
      }
    }
  };

  const startRename = (e: React.MouseEvent, title: string) => {
    e.stopPropagation();
    setRenameValue(title);
    setIsRenaming(true);
  };

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;

    try {
      await renameCanvas(id, renameValue.trim());
      setIsRenaming(false);
      setRenameValue("");
    } catch (err) {
      console.error("Failed to rename canvas:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      action();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
      setShowNewCanvasInput(false);
      setRenameValue("");
      setNewCanvasTitle("");
    }
  };

  return (
    <div className="absolute top-4 left-4 z-10" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        {/* Canvas Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 hover:bg-white transition-colors min-w-[200px] text-left"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700 truncate max-w-[140px]">
              {activeCanvas?.title || "Untitled Canvas"}
            </span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
              {/* Canvas List */}
              <div className="max-h-[300px] overflow-y-auto">
                {canvases.map((canvas) => (
                  <div
                    key={canvas.id}
                    className={`group flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                      canvas.id === activeCanvasId ? "bg-blue-50" : ""
                    }`}
                    onClick={() => handleSwitch(canvas.id)}
                  >
                    {/* Active indicator */}
                    {canvas.id === activeCanvasId && (
                      <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {!canvas.id === activeCanvasId && <div className="w-4" />}

                    {/* Title */}
                    {isRenaming && canvas.id === activeCanvasId ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, () => handleRename(canvas.id))}
                        onBlur={() => handleRename(canvas.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-sm border border-blue-300 rounded px-2 py-1 outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="flex-1 text-sm text-gray-700 truncate">
                        {canvas.title}
                      </span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => startRename(e, canvas.title)}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="Rename"
                      >
                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      {canvases.length > 1 && (
                        <button
                          onClick={(e) => handleDelete(canvas.id, e)}
                          className="p-1 hover:bg-red-100 rounded"
                          title="Delete"
                        >
                          <svg className="w-3 h-3 text-gray-500 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-200" />

              {/* New Canvas Input or Button */}
              {showNewCanvasInput ? (
                <div className="p-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newCanvasTitle}
                    onChange={(e) => setNewCanvasTitle(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, handleCreate)}
                    onBlur={() => {
                      if (newCanvasTitle.trim()) handleCreate();
                      else setShowNewCanvasInput(false);
                    }}
                    placeholder="Canvas name..."
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-blue-500"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setShowNewCanvasInput(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Canvas
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute -bottom-6 left-0">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Saving...
          </div>
        </div>
      )}
    </div>
  );
}
