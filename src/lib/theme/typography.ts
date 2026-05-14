import { TextStyle } from 'react-native';

/**
 * Typography scale based on BLOG_DESIGN_GUIDELINES.md
 */
export const typography: Record<string, TextStyle> = {
  display: {
    fontFamily: undefined, // Use system default (SF Pro on iOS, Roboto on Android)
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
  },
  h5: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  base: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  small: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  xs: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#64748b',
  },
};

export type TypographyVariant = keyof typeof typography;
