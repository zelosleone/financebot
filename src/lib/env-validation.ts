// Environment variable validation for critical systems
// Production mode uses GLM as primary LLM provider

interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePaymentEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const isDevelopmentMode = process.env.NEXT_PUBLIC_APP_MODE === 'development';

  // Development mode - minimal requirements
  if (isDevelopmentMode) {
    // Just need basic API keys for development
    if (!process.env.VALYU_API_KEY) {
      warnings.push('VALYU_API_KEY missing - financial/web search may not work');
    }
    if (!process.env.DAYTONA_API_KEY) {
      warnings.push('DAYTONA_API_KEY missing - code execution will fail');
    }
    if (!process.env.OPENAI_API_KEY && !process.env.GLM_API_KEY && !process.env.OLLAMA_BASE_URL && !process.env.LMSTUDIO_BASE_URL) {
      warnings.push('No LLM provider configured - set GLM_API_KEY, OPENAI_API_KEY, OLLAMA_BASE_URL, or LMSTUDIO_BASE_URL');
    }

    return {
      valid: true, // Development mode is always valid
      errors,
      warnings
    };
  }

  // Production mode - require LLM provider (GLM preferred, OpenAI as fallback)

  // Check for LLM provider
  const hasGLM = !!process.env.GLM_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  if (!hasGLM && !hasOpenAI) {
    errors.push('GLM_API_KEY or OPENAI_API_KEY is required for production');
  }

  if (hasGLM) {
    // GLM is configured - log status
    if (!process.env.GLM_BASE_URL) {
      warnings.push('GLM_BASE_URL not set - using default: https://api.z.ai/api/coding/paas/v4');
    }
    console.log('[ENV] GLM configured as primary LLM provider');
  }

  // Other API requirements
  if (!process.env.DAYTONA_API_KEY) {
    warnings.push('DAYTONA_API_KEY missing - code execution will fail');
  }

  // Valyu API key for search tools (optional but recommended)
  if (!process.env.VALYU_API_KEY) {
    warnings.push('VALYU_API_KEY missing - financial/web search may not work');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function logEnvironmentStatus(): void {
  const validation = validatePaymentEnvironment();

  if (!validation.valid) {
    console.error('[ENV] Configuration errors:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
  }

  if (validation.warnings.length > 0) {
    console.warn('[ENV] Configuration warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
}

// Auto-validate on import in production mode
if (process.env.NEXT_PUBLIC_APP_MODE !== 'development') {
  const validation = validatePaymentEnvironment();
  if (!validation.valid) {
    console.error('[ENV] Environment validation failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    // Don't throw in production to avoid complete app failure, but log critically
  }
}
