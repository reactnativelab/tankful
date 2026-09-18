import { Colors, Elevation, ElevationStyle, ThemeColors } from '@/constants/theme';
import { useColorScheme as useSystemColorScheme } from './useColorScheme';
import { useSettings } from './useSettings';

/**
 * The single place in the codebase that resolves "what theme are we
 * actually in": Settings > themeOverride wins when it's 'light'/'dark',
 * and only falls through to the OS scheme when it's 'system'. Every other
 * theming consumer (useThemeColors, useElevation, the root layout's
 * StatusBar) goes through this instead of calling the OS's
 * useColorScheme() directly.
 */
export function useResolvedColorScheme(): 'light' | 'dark' {
  const { themeOverride } = useSettings();
  const systemScheme = useSystemColorScheme();

  if (themeOverride === 'light' || themeOverride === 'dark') {
    return themeOverride;
  }
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function useThemeColors(): ThemeColors {
  const scheme = useResolvedColorScheme();
  return Colors[scheme];
}

export function useElevation(level: 'level1' | 'level2'): ElevationStyle {
  const scheme = useResolvedColorScheme();
  return Elevation[scheme][level];
}
