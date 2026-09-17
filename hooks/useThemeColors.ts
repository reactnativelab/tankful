import { Colors, ThemeColors } from '@/constants/theme';
import { useColorScheme } from './useColorScheme';

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
