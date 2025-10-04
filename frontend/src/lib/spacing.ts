/**
 * Simplified spacing utilities - Essential patterns only
 *
 * Based on usage analysis, these are the most commonly used spacing patterns
 * across the codebase. Simplified from 115+ constants to ~25 essentials.
 */

// Core spacing patterns - based on actual usage frequency
export const spacing = {
  // Layout patterns
  page: "min-h-screen bg-background",
  container: "container mx-auto px-4 py-8 max-w-6xl",

  // Section spacing
  section: "py-8 px-4",
  sectionCompact: "py-6 px-4",
  header: "mb-8",

  // Card spacing
  card: "p-6",
  cardCompact: "p-4",
  cardHeader: "pb-4",

  // Gap and flex spacing (most used)
  gap: {
    sm: "gap-2",
    md: "gap-4",    // Most common
    lg: "gap-6",
    xl: "gap-8",
  },

  // Margin spacing (most used patterns)
  margin: {
    xs: "mb-1",
    sm: "mb-2",     // Very common
    md: "mb-4",     // Most common
    lg: "mb-6",
    xl: "mb-8",
  },

  // Icon spacing
  icon: {
    inline: "mr-2", // Most common
    left: "ml-2",
    top: "mt-2",
  },

  // Form spacing
  form: {
    field: "mb-4",
    label: "mb-2",
    input: "p-3",
  },

  // Common layout patterns
  layouts: {
    centered: "flex items-center justify-center",
    between: "flex items-center justify-between",
    column: "flex flex-col",
    threeColumn: "grid grid-cols-3 gap-6",
    sidebar: "grid grid-cols-1 lg:grid-cols-3 gap-6",
    twoColumn: "grid grid-cols-1 lg:grid-cols-2 gap-8",
  }
};

// Helper for combining classes
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};