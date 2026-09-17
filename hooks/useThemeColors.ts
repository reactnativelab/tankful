import { Colors, Elevation, ElevationStyle, ThemeColors } from '@/constants/theme';
import { useColorScheme } from './useColorScheme';

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}

export function useElevation(level: 'level1' | 'level2'): ElevationStyle {
  const scheme = useColorScheme();
  return Elevation[scheme === 'dark' ? 'dark' : 'light'][level];
}
