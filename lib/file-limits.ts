/**
 * File size limits for the application
 * These limits balance user needs with system performance and AI processing constraints
 */

// Maximum size for a single file upload (50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

// Maximum cumulative file size for flashcard generation (50MB)
// This prevents exceeding LLM context windows and keeps processing costs reasonable
export const MAX_CUMULATIVE_SIZE_FOR_FLASHCARDS = 50 * 1024 * 1024; // 50MB in bytes

/**
 * Format bytes to human-readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if file size is within limits
 */
export function isFileSizeValid(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

/**
 * Validate cumulative file sizes for flashcard generation
 */
export function validateCumulativeFileSize(totalSize: number): {
  valid: boolean;
  error?: string;
} {
  if (totalSize > MAX_CUMULATIVE_SIZE_FOR_FLASHCARDS) {
    return {
      valid: false,
      error: `Total file size (${formatFileSize(totalSize)}) exceeds the maximum limit of ${formatFileSize(MAX_CUMULATIVE_SIZE_FOR_FLASHCARDS)} for flashcard generation. Please select fewer or smaller files.`,
    };
  }
  return { valid: true };
}

