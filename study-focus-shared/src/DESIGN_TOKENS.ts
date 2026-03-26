export const DESIGN_TOKENS = {
  colors: {
    "navy-900": "#0F172A",
    "navy-800": "#1E293B",
    "navy-700": "#334155",
    "slate-100": "#F1F5F9",
    white: "#FFFFFF",
    "accent-blue": "#1D4ED8",
  },
} as const;

export type DesignTokenColorName = keyof typeof DESIGN_TOKENS.colors;

export const TAILWIND_COLOR_TOKENS = {
  navy: {
    900: DESIGN_TOKENS.colors["navy-900"],
    800: DESIGN_TOKENS.colors["navy-800"],
    700: DESIGN_TOKENS.colors["navy-700"],
  },
  slate: {
    100: DESIGN_TOKENS.colors["slate-100"],
  },
  white: DESIGN_TOKENS.colors.white,
  accentBlue: DESIGN_TOKENS.colors["accent-blue"],
} as const;
