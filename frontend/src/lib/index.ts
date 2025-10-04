/**
 * Shared utilities library - Common exports
 */

// Export formatting utilities
export * from './format';

// Export spacing utilities
export * from './spacing';

// Re-export commonly used combinations
export { formatFileSize, formatDuration, formatVADSegments, formatErrorMessage } from './format';
export { spacing, layoutPatterns, componentSpacing } from './spacing';