import { useApiKey } from "@/context/apikey/ApiKeyContext";

/**
 * Helper to make authenticated API requests to AI endpoints
 * Automatically includes the OpenRouter API key from context
 */
export function createAIApiFetcher() {
  const { apiKey, requestApiKey } = useApiKey();

  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    // Check if API key is set
    if (!apiKey) {
      // Request the API key from user
      requestApiKey();
      throw new Error("API key required. Please enter your OpenRouter API key.");
    }

    // Add the API key to headers
    const headers = {
      ...options.headers,
      "X-OpenRouter-API-Key": apiKey,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401/403 specifically - might indicate invalid key
    if (response.status === 401 || response.status === 403) {
      const error = await response.json().catch(() => ({ error: "Unauthorized" }));
      throw new Error(error.error || "API key invalid or expired");
    }

    return response;
  };
}

/**
 * Check if API key is available and valid
 */
export function useAIAvailability() {
  const { apiKey, requestApiKey } = useApiKey();
  return {
    isAvailable: !!apiKey,
    ensureAvailable: () => {
      if (!apiKey) {
        requestApiKey();
        return false;
      }
      return true;
    },
  };
}
