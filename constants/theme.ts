export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  tint: string;
  onTint: string;
  danger: string;
  success: string;
  tabIconDefault: string;
  tabIconSelected: string;
  overlay: string;
  shadow: string;
}

export const Colors: Record<'light' | 'dark', ThemeColors> = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F6F8',
    text: '#11181C',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    tint: '#2563EB',
    onTint: '#FFFFFF',
    danger: '#DC2626',
    success: '#16A34A',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: '#2563EB',
    overlay: 'rgba(0,0,0,0.4)',
    shadow: '#000000',
  },
  dark: {
    background: '#121417',
    surface: '#1E2126',
    text: '#ECEDEE',
    textMuted: '#9BA1A6',
    border: '#2A2E35',
    tint: '#60A5FA',
    onTint: '#0B1220',
    danger: '#F87171',
    success: '#4ADE80',
    tabIconDefault: '#6B7280',
    tabIconSelected: '#60A5FA',
    overlay: 'rgba(0,0,0,0.6)',
    shadow: '#000000',
  },
};
