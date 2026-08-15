import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.livematchmv.app',
  appName: 'Livematchmv',
webDir: 'dist/public',
server: {
  url: 'https://livematchmv.online',
  cleartext: false
}
};

export default config;
