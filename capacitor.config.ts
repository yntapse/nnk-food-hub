import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.niphadfoodhub.app",
  appName: "Niphad Food Hub",
  webDir: "dist/spa",
  server: {
    // During development: point to your backend URL so API calls work on device.
    // Replace with your deployed backend URL for production builds.
    // For local testing on the same WiFi: use your laptop's IP, e.g. http://192.168.1.x:8080
    // url: "http://192.168.1.x:8080",
    androidScheme: "https",
    cleartext: true, // allow http for local dev/testing
  },
  android: {
    allowMixedContent: true, // needed for http API calls during dev
    captureInput: true,
    webContentsDebuggingEnabled: true, // disable in production
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#FC8019",
      showSpinner: false,
    },
  },
};

export default config;
