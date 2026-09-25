import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.stolypin.app',
  appName: 'СТОЛЫПИНЪ',
  webDir: 'dist',
  android: {
    backgroundColor: '#F3ECDF',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 700,
      launchAutoHide: true,
      backgroundColor: '#7C1D2B',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
