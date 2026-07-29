/**
 * Zola design tokens — derived from DESIGN.md and apps/web/app/globals.css.
 * Warm white paper + deep ocean teal + sea green accent.
 */
const colors = {
  light: {
    // Legacy aliases
    text: '#14242E',
    tint: '#22577A',

    background: '#FAFAF8',       // warm white
    foreground: '#14242E',       // deep ink-blue
    card: '#F5F2EC',             // slightly warmer than background
    cardForeground: '#14242E',

    primary: '#22577A',          // deep ocean teal
    primaryForeground: '#FAFAF8',

    secondary: '#F1EEE6',
    secondaryForeground: '#14242E',

    muted: '#F1EEE6',            // paper edge
    mutedForeground: '#5C6B73',  // cool gray

    accent: '#40916C',           // sea green
    accentForeground: '#FAFAF8',
    accentSoft: '#E0EBE5',       // faint green wash

    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    border: '#ECE7DA',           // soft cream edge
    input: '#ECE7DA',
  },
  dark: {
    text: '#E8DECB',
    tint: '#22577A',

    background: '#0E1A22',       // deep ink
    foreground: '#E8DECB',       // warm cream
    card: '#1A2A33',             // slightly raised
    cardForeground: '#E8DECB',

    primary: '#22577A',          // unchanged in dark
    primaryForeground: '#FAFAF8',

    secondary: '#1A2A33',
    secondaryForeground: '#E8DECB',

    muted: '#1A2A33',
    mutedForeground: '#93A2AC',  // cool gray

    accent: '#6BC4A0',           // lighter sea green (AA contrast)
    accentForeground: '#0E1A22',
    accentSoft: '#1A2A33',

    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    border: '#1F2F3A',           // ink edge
    input: '#1F2F3A',
  },
  radius: 10,
} as const;

export default colors;
