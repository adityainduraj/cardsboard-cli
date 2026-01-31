import { z } from "zod"

/**
 * Validation schemas for canvas data
 * Ensures data integrity before saving to database
 */

// Node schema - simplified for Zod v4 compatibility
export const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["design", "sketch", "text", "image", "section"]),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.any()),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  selected: z.boolean().optional(),
  dragging: z.boolean().optional(),
})

// Edge schema
export const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  type: z.enum(["default", "straight", "step", "smoothstep"]).optional(),
  animated: z.boolean().optional(),
  hidden: z.boolean().optional(),
  label: z.string().max(500).optional(),
  style: z.record(z.any()).optional(),
})

// Canvas data schema
export const canvasDataSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().min(1),
  title: z.string().min(1).max(200),
  nodes: z.array(nodeSchema).max(500),
  edges: z.array(edgeSchema).max(1000),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

// Export types
export type ValidatedNode = z.infer<typeof nodeSchema>
export type ValidatedEdge = z.infer<typeof edgeSchema>
export type ValidatedCanvasData = z.infer<typeof canvasDataSchema>

/**
 * Validate canvas data before saving
 * @throws {z.ZodError} If validation fails
 */
export function validateCanvasData(data: unknown): ValidatedCanvasData {
  const result = canvasDataSchema.safeParse(data)
  if (!result.success) {
    throw result.error
  }
  return result.data
}

/**
 * Safely validate canvas data
 * @returns Result with data or validation errors
 */
export function safeValidateCanvasData(
  data: unknown
): { success: true; data: ValidatedCanvasData } | { success: false; errors: z.ZodError } {
  const result = canvasDataSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, errors: result.error }
}

/**
 * Validate a single node
 */
export function validateNode(node: unknown): ValidatedNode {
  const result = nodeSchema.safeParse(node)
  if (!result.success) {
    throw result.error
  }
  return result.data
}

/**
 * Validate HTML content for design nodes
 * Prevents XSS by checking for dangerous patterns
 */
export function sanitizeHtmlContent(html: string): string {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")

  // Remove event handlers (onclick, onerror, onmouseover, etc.) - case insensitive
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")

  // Remove inline event handlers without quotes
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, "")

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, "")

  return sanitized
}
