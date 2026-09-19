// --- Palette --------------------------------------------------------------
// Amber/orange brand scale. The 700/400 stops below are what's actually
// wired into `tint` per theme -- chosen (not eyeballed) so the same hex
// works both as a solid button/tab fill (paired with onTint text) and as
// the color itself when it shows up as text on the app's background.
// WCAG 2.1 contrast, checked with the standard relative-luminance formula:
//   light tint #B45309 on #FFFFFF / #F5F6F8 -> 5.02:1 / 5.02:1 (AA text)
//   dark  tint #FBBF24 on #121417 / #1E2126 -> 11.05:1 / 9.67:1
const amber = {
  400: '#FBBF24',
  700: '#B45309',
};

// Neutral/ink scale backing the surfaces and text of both themes.
const ink = {
  light: {
    0: '#FFFFFF',
    50: '#F5F6F8',
    100: '#ECEEF1',
    200: '#E5E7EB',
    500: '#6B7280',
    900: '#11181C',
  },
  dark: {
    50: '#ECEDEE',
    400: '#9BA1A6',
    600: '#2A2E35',
    700: '#262B33',
    800: '#1E2126',
    900: '#121417',
  },
};

export interface ThemeColors {
  background: string;
  surface: string;
  /** A step lighter (dark mode) than `surface`, for cards that need to read as raised without a shadow. */
  surfaceElevated: string;
  text: string;
  textMuted: string;
  border: string;
  tint: string;
  onTint: string;
  danger: string;
  /** A fill/fuel-up's mileage reading above this vehicle's average. Never substitute `tint` for this -- they mean different things even when both are warm-toned. */
  mileageGood: string;
  /** A mileage reading below this vehicle's average. */
  mileageBad: string;
  tabIconDefault: string;
  tabIconSelected: string;
  overlay: string;
  /** Two-stop diagonal fill for the Home hero card. Both stops are dark/saturated enough that `onTint` text over either one clears WCAG AA -- see the per-stop ratios above the light/dark definitions below. */
  heroGradient: [string, string];
}

export const Colors: Record<'light' | 'dark', ThemeColors> = {
  light: {
    background: ink.light[0],
    surface: ink.light[50],
    surfaceElevated: ink.light[100],
    text: ink.light[900],
    textMuted: ink.light[500],
    border: ink.light[200],
    tint: amber[700],
    onTint: '#FFFFFF',
    danger: '#DC2626',
    // green-700, 5.02:1 on white -- passes AA text (green-600 alone only hit ~3.3:1)
    mileageGood: '#15803D',
    // rose-600, 4.70:1 on white -- reads as red, not amber, so it can't be
    // mistaken for the brand accent when both appear near each other
    mileageBad: '#E11D48',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: amber[700],
    overlay: 'rgba(0,0,0,0.4)',
    // onTint (#FFFFFF) on #B45309 -> 5.02:1, on #92400E -> 7.09:1 (both AA
    // text-pass; interpolated stops stay within that range).
    heroGradient: [amber[700], '#92400E'],
  },
  dark: {
    background: ink.dark[900],
    surface: ink.dark[800],
    surfaceElevated: ink.dark[700],
    text: ink.dark[50],
    textMuted: ink.dark[400],
    border: ink.dark[600],
    tint: amber[400],
    onTint: '#211505',
    danger: '#F87171',
    mileageGood: '#4ADE80',
    mileageBad: '#FB7185',
    tabIconDefault: '#6B7280',
    tabIconSelected: amber[400],
    overlay: 'rgba(0,0,0,0.6)',
    // onTint (#211505) on #FBBF24 -> 10.71:1, on #F59E0B -> 8.33:1 (both AA
    // text-pass; interpolated stops stay within that range).
    heroGradient: [amber[400], '#F59E0B'],
  },
};

// --- Radius -----------------------------------------------------------------
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

// --- Space ------------------------------------------------------------------
export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// --- Elevation ----------------------------------------------------------
export interface ElevationStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

// Shadows barely read on dark surfaces, so dark mode signals elevation via
// `surfaceElevated` instead -- both levels are shadow-less there. Light mode
// gets a real shadow, stronger at level2 than level1.
export const Elevation: Record<'light' | 'dark', { level1: ElevationStyle; level2: ElevationStyle }> = {
  light: {
    level1: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
    level2: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
  },
  dark: {
    level1: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    level2: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },
};
