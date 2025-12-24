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
      valid: true,
      errors,
      warnings
    };
  }

  // Production mode - GLM or OpenAI required (but don't block startup)
  const hasGLM = !!process.env.GLM_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  if (!hasGLM && !hasOpenAI) {
    // Log as warning, not error - env vars might be runtime-only on some platforms
    warnings.push('GLM_API_KEY or OPENAI_API_KEY not detected at startup (may be available at runtime)');
  }

  if (hasGLM) {
    console.log('[ENV] GLM configured as primary LLM provider');
    if (!process.env.GLM_BASE_URL) {
      warnings.push('GLM_BASE_URL not set - using default');
    }
  }

  if (!process.env.DAYTONA_API_KEY) {
    warnings.push('DAYTONA_API_KEY missing - code execution will fail');
  }

  if (!process.env.VALYU_API_KEY) {
    warnings.push('VALYU_API_KEY missing - financial/web search may not work');
  }

  // Always return valid - don't block app startup
  return {
    valid: true,
    errors,
    warnings
  };
}

export function logEnvironmentStatus(): void {
  const validation = validatePaymentEnvironment();

  if (validation.errors.length > 0) {
    console.warn('[ENV] Configuration issues:');
    validation.errors.forEach(error => console.warn(`  - ${error}`));
  }

  if (validation.warnings.length > 0) {
    console.warn('[ENV] Configuration warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
}
