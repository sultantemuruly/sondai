/**
 * Server-side guardrails with OpenAI moderation API
 * Use this for comprehensive server-side validation
 */

interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Server-side validation - optimized for speed
 * Removed OpenAI moderation API check (no longer blocking harassment/profanity)
 * Only checks for security-critical issues (prompt injection, sensitive data)
 */
export async function validateUserInstructionsServer(instructions: string): Promise<ValidationResult> {
  if (!instructions || instructions.trim().length === 0) {
    return { isValid: true, sanitized: '' };
  }

  const trimmed = instructions.trim();

  // Import client-side validation (only checks security issues now)
  const { validateUserInstructions } = await import('./guardrails');
  
  // Only validate for security issues (prompt injection, sensitive data)
  // No longer checking for profanity/harassment
  const validation = validateUserInstructions(trimmed);
  
  return validation;
}

