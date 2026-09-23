/**
 * LabourBook Mobile Design Tokens
 * Extracted from the reference UI design.
 */

export const C = {
  // Surfaces
  background:           '#fcf9f8',
  surface:              '#fcf9f8',
  surfaceLowest:        '#ffffff',
  surfaceLow:           '#f6f3f2',
  surfaceContainer:     '#f0eded',
  surfaceHigh:          '#eae7e7',
  surfaceHighest:       '#e4e2e1',

  // Primary (dark forest green)
  primary:              '#012d1d',
  primaryContainer:     '#1b4332',
  primaryFixed:         '#c1ecd4',
  primaryFixedDim:      '#a5d0b9',
  onPrimary:            '#ffffff',
  onPrimaryContainer:   '#86af99',
  onPrimaryFixedVariant:'#274e3d',

  // Secondary (blue-gray)
  secondaryContainer:   '#d7e4f0',
  onSecondaryContainer: '#596670',

  // Tertiary (deep red — used for amounts / warnings)
  tertiary:             '#510900',
  tertiaryFixed:        '#ffdad3',
  onTertiaryFixed:      '#3e0500',

  // Surfaces text
  onSurface:            '#1b1c1c',
  onSurfaceVariant:     '#414844',
  outlineVariant:       '#c1c8c2',
  outline:              '#717973',

  // Error
  error:                '#ba1a1a',
  errorContainer:       '#ffdad6',
} as const;

export const R = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  28,
  full: 9999,
} as const;

export const S = {
  // Header
  headerBg:     C.surface,
  headerHeight: 60,
  tabBarHeight: 60,
  pagePadding:  16,
};

/** Avatar color cycle */
export const AVATAR_COLORS = [
  { bg: '#c1ecd4', fg: '#012d1d' },
  { bg: '#d7e4f0', fg: '#111d25' },
  { bg: '#fef3c7', fg: '#6b4c04' },
  { bg: '#ffdad3', fg: '#510900' },
  { bg: '#e8d5f7', fg: '#3d1457' },
];

export function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

export function fmtCurrency(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
