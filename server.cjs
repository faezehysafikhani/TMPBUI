var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  app: () => app,
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);

// scripts/security-headers-lib.mjs
function buildHeaders(config) {
  const headers = { ...config.always };
  headers["Strict-Transport-Security"] = config.strictTransportSecurity;
  headers["Permissions-Policy"] = config.permissionsPolicy;
  if (config.cspMode !== "off") {
    const extra = (config.connectSrcExtra || []).join(" ");
    const policy = config.contentSecurityPolicy.map((directive) => extra && directive.startsWith("connect-src ") ? `${directive} ${extra}` : directive);
    if (config.cspReportUri) policy.push(`report-uri ${config.cspReportUri}`);
    headers[config.cspMode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only"] = policy.join("; ");
  }
  return headers;
}

// security-headers.json
var security_headers_default = {
  _comment: 'The one place the response security headers are defined. server.ts reads it; public/web.config and vercel.json are generated from it (npm run headers:sync) and checked by npm run headers:check. The Content-Security-Policy starts in report-only mode: violations are reported to /api/platform/csp-report and nothing is blocked. After the reports of about two weeks are clean, change "cspMode" to "enforce" and run npm run headers:sync.',
  cspMode: "report-only",
  cspReportUri: "/api/platform/csp-report",
  connectSrcExtra: [],
  contentSecurityPolicy: [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "style-src-elem 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob: data:",
    "connect-src 'self' wss:",
    "frame-src blob:",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ],
  strictTransportSecurity: "max-age=31536000; includeSubDomains",
  permissionsPolicy: "camera=(), geolocation=(), microphone=(self)",
  always: {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer"
  }
};

// server.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
function apiOriginsFromEnv() {
  const origins = /* @__PURE__ */ new Set();
  for (const value of [process.env.VITE_API_BASE_URL, process.env.VITE_SIGNALR_BASE_URL]) {
    try {
      const url = new URL(String(value || "").trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      origins.add(url.origin);
      origins.add(url.origin.replace(/^http/, "ws"));
    } catch {
    }
  }
  return [...origins];
}
var PORT = process.env.PORT || 3e3;
var API_PROXY_TARGET = process.env.API_PROXY_TARGET || "https://localhost:7271";
var devProxy = null;
app.use((req, res, next) => devProxy ? devProxy(req, res, next) : next());
app.use(import_express.default.json({ limit: "100kb" }));
app.disable("x-powered-by");
var securityHeaders = process.env.NODE_ENV === "production" ? buildHeaders({
  ...security_headers_default,
  // When the API is on another origin (not the intended same-origin setup): its address for the
  // report endpoint and for connect-src, e.g. CSP_REPORT_URI=http://localhost:5271/api/platform/csp-report
  // CSP_CONNECT_SRC="http://localhost:5271 ws://localhost:5271".
  cspReportUri: process.env.CSP_REPORT_URI || security_headers_default.cspReportUri,
  connectSrcExtra: process.env.CSP_CONNECT_SRC ? process.env.CSP_CONNECT_SRC.split(/\s+/).filter(Boolean) : [...security_headers_default.connectSrcExtra, ...apiOriginsFromEnv()]
}) : {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer"
};
app.use((_req, res, next) => {
  for (const [name, value] of Object.entries(securityHeaders)) {
    res.setHeader(name, value);
  }
  next();
});
app.get(["/api/health", "/health"], (_req, res) => {
  res.json({ status: "ok" });
});
app.get(["/icon.svg", "/favicon.svg"], (req, res) => {
  const userAgent = (req.headers["user-agent"] || "").toLowerCase();
  const isRasterOnlyCrawler = /whatsapp|facebookexternalhit|facebot/i.test(userAgent);
  const publicDir = import_path.default.join(process.cwd(), "public");
  const distDir = import_path.default.join(process.cwd(), "dist");
  if (isRasterOnlyCrawler) {
    const pngCandidate = import_fs.default.existsSync(import_path.default.join(publicDir, "icon-512.png")) ? import_path.default.join(publicDir, "icon-512.png") : import_path.default.join(distDir, "icon-512.png");
    if (import_fs.default.existsSync(pngCandidate)) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(pngCandidate);
    }
  }
  const svgCandidate = import_fs.default.existsSync(import_path.default.join(publicDir, "icon.svg")) ? import_path.default.join(publicDir, "icon.svg") : import_path.default.join(distDir, "icon.svg");
  if (import_fs.default.existsSync(svgCandidate)) {
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.sendFile(svgCandidate);
  }
  res.status(404).end();
});
async function startServer() {
  if (process.env.VERCEL !== "1") {
    if (process.env.NODE_ENV !== "production") {
      const { createProxyMiddleware } = await import("http-proxy-middleware");
      devProxy = createProxyMiddleware({
        target: API_PROXY_TARGET,
        changeOrigin: true,
        secure: false,
        ws: true,
        pathFilter: (pathname) => pathname.startsWith("/api/") && pathname !== "/api/health" || pathname.startsWith("/hubs/")
      });
      console.log(`Dev proxy: /api and /hubs -> ${API_PROXY_TARGET}`);
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = import_path.default.join(process.cwd(), "dist");
      app.use(import_express.default.static(distPath, {
        maxAge: "1d",
        setHeaders: (res, filepath) => {
          if (filepath.endsWith(".png") || filepath.endsWith(".svg") || filepath.endsWith(".ico")) {
            res.setHeader("Cache-Control", "public, max-age=86400");
          }
          if (/[\\/]dist[\\/](index\.html|sw\.js|config[\\/]runtime-config\.json)$/.test(filepath)) {
            res.setHeader("Cache-Control", "no-cache");
          } else if (/[\\/]assets[\\/]/.test(filepath)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        }
      }));
      app.get("*", (req, res) => {
        const indexPath = import_path.default.join(distPath, "index.html");
        if (import_fs.default.existsSync(indexPath)) {
          try {
            const html = import_fs.default.readFileSync(indexPath, "utf-8");
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache");
            return res.send(html);
          } catch (e) {
            console.error("Error reading index.html:", e);
          }
        }
        res.sendFile(indexPath);
      });
    }
    const server = app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
    if (devProxy?.upgrade) server.on("upgrade", devProxy.upgrade);
  }
}
startServer();
var server_default = app;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  app
});
