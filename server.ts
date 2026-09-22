import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));

// CORS middleware for Vercel and proxies
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// Health check endpoint
app.get(["/api/health", "/health"], (_req, res) => {
  res.json({ status: "ok" });
});

// App Icon endpoint with link-preview crawler compatibility
app.get(["/icon.svg", "/favicon.svg"], (req, res) => {
  const userAgent = (req.headers["user-agent"] || "").toLowerCase();
  // WhatsApp and Facebook scrapers fail on vector SVGs and require raster images (PNG)
  const isRasterOnlyCrawler = /whatsapp|facebookexternalhit|facebot/i.test(userAgent);
  
  const publicDir = path.join(process.cwd(), "public");
  const distDir = path.join(process.cwd(), "dist");

  if (isRasterOnlyCrawler) {
    const pngCandidate = fs.existsSync(path.join(publicDir, "icon-512.png"))
      ? path.join(publicDir, "icon-512.png")
      : path.join(distDir, "icon-512.png");
    if (fs.existsSync(pngCandidate)) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(pngCandidate);
    }
  }

  const svgCandidate = fs.existsSync(path.join(publicDir, "icon.svg"))
    ? path.join(publicDir, "icon.svg")
    : path.join(distDir, "icon.svg");
  if (fs.existsSync(svgCandidate)) {
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.sendFile(svgCandidate);
  }

  res.status(404).end();
});

// Vite middleware setup for dev vs static build (only when not running on Vercel)
async function startServer() {
  if (process.env.VERCEL !== "1") {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      
      // Serve static files with proper caching headers
      app.use(express.static(distPath, {
        maxAge: '1d',
        setHeaders: (res, filepath) => {
          if (filepath.endsWith('.png') || filepath.endsWith('.svg') || filepath.endsWith('.ico')) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        }
      }));

      app.get("*", (req, res) => {
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          try {
            const host = (req.headers["x-forwarded-host"] || req.headers.host || "task.parspmi.ir").toString();
            const proto = (req.headers["x-forwarded-proto"] || "https").toString();
            const currentOrigin = `${proto}://${host}`;

            let html = fs.readFileSync(indexPath, "utf-8");
            if (host && !host.includes('task.parspmi.ir')) {
              html = html.replace(/https:\/\/task\.parspmi\.ir/g, currentOrigin);
            }
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(html);
          } catch (e) {
            console.error("Error reading index.html:", e);
          }
        }
        res.sendFile(indexPath);
      });
    }

    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

export default app;
