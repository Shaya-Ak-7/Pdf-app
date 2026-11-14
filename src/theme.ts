import { ColorSchemeName } from 'react-native';

export function createTheme(colorScheme: ColorSchemeName) {
  const dark = colorScheme === 'dark';

  return {
    dark,
    colors: {
      background: dark ? '#0f0f0f' : '#f6f6f4',
      surface: dark ? '#181818' : '#ffffff',
      surfaceMuted: dark ? '#222222' : '#efefec',
      border: dark ? '#2d2d2d' : '#deded8',
      text: dark ? '#f2f2f2' : '#161616',
      muted: dark ? '#a1a1a1' : '#696966',
      faint: dark ? '#6f6f6f' : '#9a9a95',
      accent: dark ? '#d6d3c8' : '#262626',
      accentSoft: dark ? '#2d2b25' : '#ece8dd',
      danger: '#b42318',
      success: '#1f7a3a',
      input: dark ? '#111111' : '#fbfbfa',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
    },
    radius: {
      sm: 8,
      md: 12,
      lg: 18,
    },
  };
}

export type AppTheme = ReturnType<typeof createTheme>;
