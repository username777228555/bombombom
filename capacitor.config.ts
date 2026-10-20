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
    // Vasily's reminders (src/core/reminders.ts): status bar icon and its tint.
    LocalNotifications: {
      smallIcon: 'ic_stat_vasily',
      iconColor: '#7C1D2B',
    },
  },
};

export default config;
