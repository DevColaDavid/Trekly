export const colors = {
  background: '#F7F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F2F6',
  border: '#E7E8EF',
  text: '#15161E',
  textMuted: '#6B6E7B',
  textFaint: '#A0A3B1',
  primary: '#4F46E5',
  primarySoft: '#EEF0FF',
  primaryText: '#3730A3',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warningSoft: '#FEF3C7',
  warningText: '#92400E',
  dark: '#16171F',
  darkAlt: '#22232E',
} as const;

import { Platform } from 'react-native';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

// RN Web deprecated shadow* style props in favor of the CSS boxShadow prop;
// native (iOS/Android) doesn't understand boxShadow, so branch per platform.
export const shadow = Platform.select({
  web: {
    card: { boxShadow: '0 4px 12px rgba(15,16,36,0.06)' },
    popover: { boxShadow: '0 12px 28px rgba(15,16,36,0.18)' },
  },
  default: {
    card: {
      shadowColor: '#0F1024',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    popover: {
      shadowColor: '#0F1024',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 28,
      elevation: 12,
    },
  },
})!;

export const typography = {
  title: { fontSize: 24, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text },
  caption: { fontSize: 12, fontWeight: '600' as const, color: colors.textMuted },
};

export const eventPalette = [
  { bg: '#EEF0FF', text: '#3730A3' },
  { bg: '#DCFCE7', text: '#166534' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#E0F2FE', text: '#075985' },
];

export function colorForString(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return eventPalette[hash % eventPalette.length];
}
