import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, matchesTable, tournamentsTable, squadsTable } from "@workspace/db";

const BASE_URL = process.env.REPLIT_DOMAINS
  ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
  : "https://www.livematchmv.online";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()).filter(Boolean)
  : [];

// Always allow Replit dev/preview domains and any domains declared in REPLIT_DOMAINS
const replitDomains = process.env.REPLIT_DOMAINS
  ? process.env.REPLIT_DOMAINS.split(",").map(o => `https://${o.trim()}`).filter(Boolean)
  : [];

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.length === 0) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (replitDomains.includes(origin)) return true;
  // Allow any Replit-hosted preview/dev domain
  if (/\.replit\.dev$/.test(new URL(origin).hostname)) return true;
  if (/\.replit\.app$/.test(new URL(origin).hostname)) return true;
  return false;
}

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    try {
      if (isAllowedOrigin(origin)) return callback(null, true);
    } catch { /* invalid URL — fall through to reject */ }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SESSION_SECRET || "fallback-secret"));

app.use("/api", router);

// Serve built frontend in production
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const staticDir = path.resolve(__dirname, "../../football-app/dist/public");
  app.use(express.static(staticDir));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

// ── Dynamic sitemap ───────────────────────────────────────────────────────────
app.get("/sitemap.xml", async (_req, res) => {
  try {
    const [matches, tournaments, players] = await Promise.all([
      db.select({ id: matchesTable.id, kickoffAt: matchesTable.kickoffAt }).from(matchesTable),
      db.select({ id: tournamentsTable.id }).from(tournamentsTable),
      db.select({ id: squadsTable.id }).from(squadsTable),
    ]);

    const today = new Date().toISOString().split("T")[0];

    const staticPages = [
      { loc: `${BASE_URL}/`, changefreq: "daily", priority: "1.0" },
      { loc: `${BASE_URL}/live`, changefreq: "always", priority: "0.9" },
      { loc: `${BASE_URL}/tournaments`, changefreq: "daily", priority: "0.8" },
      { loc: `${BASE_URL}/players`, changefreq: "weekly", priority: "0.7" },
    ];

    const urlTags = [
      ...staticPages.map(p => `
  <url>
    <loc>${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`),

      ...matches.map(m => `
  <url>
    <loc>${BASE_URL}/match/${m.id}</loc>
    <lastmod>${m.kickoffAt ? new Date(m.kickoffAt).toISOString().split("T")[0] : today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>`),

      ...tournaments.map(t => `
  <url>
    <loc>${BASE_URL}/tournament/${t.id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`),

      ...players.map(p => `
  <url>
    <loc>${BASE_URL}/player/${p.id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`),
    ].join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlTags}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    logger.error({ err }, "Failed to generate sitemap");
    res.status(500).send("Failed to generate sitemap");
  }
});

export default app;
