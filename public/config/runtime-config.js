// Runtime configuration for deployed environments.
//
// This file is copied to dist/config/runtime-config.js during build and can be edited
// after build without rebuilding the React application.
//
// Same-origin deployment (preferred behind IIS/reverse proxy):
//   apiBaseUrl: ""
//   signalRBaseUrl: ""
//
// Separate backend origin:
//   apiBaseUrl: "https://api.example.local"
//   signalRBaseUrl: "https://api.example.local"
window.__TMPB_RUNTIME_CONFIG__ = {
  apiBaseUrl: "",
  signalRBaseUrl: "",
  tenantSlug: "",
  requestTimeoutMs: 30000
};
