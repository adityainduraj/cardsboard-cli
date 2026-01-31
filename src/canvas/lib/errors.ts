/**
 * Custom error classes for better error handling and user feedback
 */

/**
 * Base error class for application errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
    public readonly code?: string
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Canvas-related errors
 */
export class CanvasSaveError extends AppError {
  constructor(
    message: string,
    userMessage: string = "Failed to save canvas. Please try again."
  ) {
    super(message, userMessage, "CANVAS_SAVE_ERROR")
  }
}

export class CanvasLoadError extends AppError {
  constructor(
    message: string,
    userMessage: string = "Failed to load canvas. Please try again."
  ) {
    super(message, userMessage, "CANVAS_LOAD_ERROR")
  }
}

export class CanvasValidationError extends AppError {
  constructor(
    message: string,
    userMessage: string = "Invalid canvas data. Some content may be corrupted."
  ) {
    super(message, userMessage, "CANVAS_VALIDATION_ERROR")
  }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string,
    userMessage: string = "Authentication failed. Please sign in again."
  ) {
    super(message, userMessage, "AUTH_ERROR")
  }
}

export class SessionExpiredError extends AppError {
  constructor(
    message: string = "Session expired",
    userMessage: string = "Your session has expired. Please sign in again."
  ) {
    super(message, userMessage, "SESSION_EXPIRED")
  }
}

/**
 * Network errors
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    userMessage: string = "Network error. Please check your connection."
  ) {
    super(message, userMessage, "NETWORK_ERROR")
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    userMessage: string = "Invalid input. Please check your data."
  ) {
    super(message, userMessage, "VALIDATION_ERROR")
  }
}

/**
 * Utility function to get a user-friendly error message
 */
export function getUserFriendlyError(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage
  }

  if (error instanceof Error) {
    // Check for common error patterns
    const message = error.message.toLowerCase()

    if (message.includes("network") || message.includes("fetch")) {
      return "Network error. Please check your connection."
    }

    if (message.includes("auth") || message.includes("unauthorized")) {
      return "Authentication failed. Please sign in again."
    }

    if (message.includes("timeout")) {
      return "Request timed out. Please try again."
    }

    // Return a generic error message
    return error.message
  }

  return "An unexpected error occurred. Please try again."
}

/**
 * Utility function to log errors for debugging
 */
export function logError(error: unknown, context?: string): void {
  const prefix = context ? `[${context}]` : ""
  const errorMessage = error instanceof Error ? error.message : String(error)

  if (process.env.NODE_ENV === "development") {
    console.error(`${prefix} Error:`, error)
  } else {
    // In production, you might want to send this to an error tracking service
    console.error(`${prefix} ${errorMessage}`)
  }
}
