/**
 * Guardrails for user input validation
 * Only checks for security-critical issues: sensitive information and prompt injection
 * Anti-harassment checks removed for speed and to allow legitimate educational content
 */

interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Patterns that indicate sensitive information
 */
const SENSITIVE_PATTERNS = [
  // API keys and tokens
  /api[_-]?key\s*[:=]\s*['"]?[\w\-]{20,}/i,
  /token\s*[:=]\s*['"]?[\w\-]{20,}/i,
  /secret\s*[:=]\s*['"]?[\w\-]{20,}/i,
  /password\s*[:=]\s*['"]?.{8,}/i,
  /private[_-]?key/i,
  /access[_-]?token/i,
  /bearer\s+[\w\-\.]+/i,
  
  // Common credential patterns
  /(sk|pk)_[\w\-]{20,}/i, // Stripe keys
  /AIza[\w\-]{35}/i, // Google API keys
  /AKIA[0-9A-Z]{16}/i, // AWS keys
  /xox[baprs]-[\w\-]{10,}/i, // Slack tokens
  
  // Email patterns (to prevent email harvesting)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Credit card patterns
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
  
  // SSN patterns
  /\b\d{3}-\d{2}-\d{4}\b/,
  
  // Common prompt injection attempts
  /ignore\s+(previous|all|above|prior)\s+instructions?/i,
  /forget\s+(previous|all|above|prior)\s+instructions?/i,
  /you\s+are\s+now/i,
  /system\s*:?\s*you/i,
  /\[(system|admin|root)\]/i,
  /override\s+system/i,
];

/**
 * List of inappropriate words/phrases (basic list - in production, use a professional service)
 */
const INAPPROPRIATE_WORDS = [
  // Add common inappropriate terms - keeping minimal for now
  // In production, use a proper content moderation service
];

/**
 * Check for sensitive information patterns
 */
function containsSensitiveInfo(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Check sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  // Check for common sensitive keywords in context
  const sensitiveKeywords = [
    'api key', 'private key', 'secret key', 'access token',
    'password', 'credential', 'authentication', 'authorization',
    'ssh key', 'gpg key', 'database password', 'admin password'
  ];
  
  for (const keyword of sensitiveKeywords) {
    if (lowerText.includes(keyword) && text.length < 200) {
      // If short text contains these keywords, likely sensitive
      return true;
    }
  }
  
  return false;
}

/**
 * DISABLED: Anti-harassment checks removed for speed and to allow legitimate educational content
 * This function always returns false - no content filtering
 * Only security-critical checks remain (prompt injection and sensitive data)
 */
function containsInappropriateContent(text: string): boolean {
  // DISABLED - No longer checking for profanity/harassment
  // Removed for speed and to allow legitimate educational terms (like MRS, MRT)
  return false;
}

/**
 * Check for prompt injection attempts
 */
function containsPromptInjection(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  const injectionPatterns = [
    /ignore\s+(all|previous|above|prior)\s+(instructions?|directives?|rules?)/i,
    /forget\s+(all|previous|above|prior)\s+(instructions?|directives?|rules?)/i,
    /disregard\s+(all|previous|above|prior)\s+(instructions?|directives?|rules?)/i,
    /you\s+are\s+now\s+(a|an)\s+/i,
    /system\s*:?\s*you\s+(must|should|will|are)/i,
    /\[(system|admin|root|developer|user)\]/i,
    /override\s+(system|safety|guard|protection)/i,
    /bypass\s+(system|safety|guard|protection)/i,
    /jailbreak/i,
    /roleplay/i,
    /pretend\s+you\s+are/i,
    /act\s+as\s+if/i,
    /generate\s+(code|script|program)/i,
    /write\s+(code|script|program)/i,
    /execute\s+(code|command|script)/i,
  ];
  
  for (const pattern of injectionPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Sanitize user instructions by removing potentially dangerous patterns
 */
function sanitizeInstructions(text: string): string {
  let sanitized = text;
  
  // Remove common injection attempts
  sanitized = sanitized.replace(/ignore\s+(all|previous|above|prior)\s+instructions?/gi, '');
  sanitized = sanitized.replace(/forget\s+(all|previous|above|prior)\s+instructions?/gi, '');
  sanitized = sanitized.replace(/\[(system|admin|root)\]/gi, '');
  
  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

/**
 * Validate and sanitize user instructions for flashcard generation
 * This is a synchronous function for client-side validation
 */
export function validateUserInstructions(instructions: string): ValidationResult {
  if (!instructions || instructions.trim().length === 0) {
    return { isValid: true, sanitized: '' };
  }
  
  const trimmed = instructions.trim();
  
  // Check length (max 50,000 characters to prevent abuse while allowing detailed instructions)
  if (trimmed.length > 50000) {
    return {
      isValid: false,
      error: 'Instructions are too long. Please keep them under 50,000 characters.',
    };
  }
  
  // Check for sensitive information (security-critical)
  if (containsSensitiveInfo(trimmed)) {
    return {
      isValid: false,
      error: 'Instructions cannot contain sensitive information like API keys, passwords, or credentials. Please remove any sensitive data.',
    };
  }
  
  // Check for prompt injection
  if (containsPromptInjection(trimmed)) {
    return {
      isValid: false,
      error: 'Instructions cannot override system behavior. Please provide educational instructions only.',
    };
  }
  
  // Sanitize and return (only if it passed all checks)
  const sanitized = sanitizeInstructions(trimmed);
  
  return {
    isValid: true,
    sanitized,
  };
}


