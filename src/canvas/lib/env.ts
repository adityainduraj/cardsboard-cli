import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { z } from 'zod'

/**
 * Runtime environment variable validation
 * For CLI mode, all variables are optional with sensible defaults
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().default('http://localhost'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional().default('local'),
  NEXT_PUBLIC_AI_CONTEXT_LIMIT: z.coerce.number().min(1).max(10).optional().default(5),
  NEXT_PUBLIC_AI_DEFAULT_VARIATIONS: z.coerce.number().optional().default(3),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_SITE_URL: z.string().url().optional().default('https://cardsboard.app'),
  OPENROUTER_APP_NAME: z.string().optional().default('Cardsboard'),
})

export type Env = z.infer<typeof envSchema>

let validatedEnv: Env | null = null

export function getEnv(): Env {
  if (validatedEnv) {
    return validatedEnv
  }

  try {
    validatedEnv = envSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })
    return validatedEnv
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => `  - ${e.message}`).join('\n')
      throw new Error(
        `Missing or invalid environment variables:\n${missingVars}\n\n` +
        `Please check your .env.local file and ensure all required variables are set.`
      )
    }
    throw error
  }
}

/**
 * Validate env and return Supabase client
 */
export function createClient() {
  const env = getEnv()
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
