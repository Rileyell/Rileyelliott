import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import config from "./zosite.json";
import { Hono } from "hono";

// FAQ Dashboard — Generic multi-tenant FAQ system
// API handlers
import eventsCreate from "./backend-lib/faq-api/events-create";
import eventsList from "./backend-lib/faq-api/events-list";
import eventsLogo from "./backend-lib/faq-api/events-logo";
import eventsScrape from "./backend-lib/faq-api/events-scrape";
import eventsUpdate from "./backend-lib/faq-api/events-update";
import eventsUpdateUrl from "./backend-lib/faq-api/events-update-url";
import eventsUploadLogo from "./backend-lib/faq-api/events-upload-logo";
import faqCreate from "./backend-lib/faq-api/faq-create";
import faqDelete from "./backend-lib/faq-api/faq-delete";
import faqDismissQuestion from "./backend-lib/faq-api/faq-dismiss-question";
import faqExport from "./backend-lib/faq-api/faq-export";
import faqList from "./backend-lib/faq-api/faq-list";
import faqListSubmitted from "./backend-lib/faq-api/faq-list-submitted";
import faqNotifyAdminCreation from "./backend-lib/faq-api/faq-notify-admin-creation";
import faqSubmitQuestion from "./backend-lib/faq-api/faq-submit-question";
import faqUpdate from "./backend-lib/faq-api/faq-update";
import analyticsSummary from "./backend-lib/faq-api/analytics-summary";
import analyticsTrack from "./backend-lib/faq-api/analytics-track";

type Mode = "development" | "production";
const app = new Hono();

const mode: Mode =
  process.env.NODE_ENV === "production" ? "production" : "development";

// ── Events ──────────────────────────────────────────────────────────────────
app.get("/api/events/list", eventsList);
app.post("/api/events/create", eventsCreate);
app.post("/api/events/update", eventsUpdate);
app.post("/api/events/update-url", eventsUpdateUrl);
app.post("/api/events/upload-logo", eventsUploadLogo);
app.post("/api/events/scrape", eventsScrape);
app.get("/api/events/logo", eventsLogo);
app.get("/api/events/logo/:slug", eventsLogo);

// ── FAQ Entries ──────────────────────────────────────────────────────────────
app.get("/api/faq/list", faqList);
app.get("/api/faq/list-submitted", faqListSubmitted);
app.post("/api/faq/create", faqCreate);
app.post("/api/faq/update", faqUpdate);
app.post("/api/faq/delete", faqDelete);
app.post("/api/faq/dismiss-question", faqDismissQuestion);
app.post("/api/faq/export", faqExport);
app.post("/api/faq/submit-question", faqSubmitQuestion);
app.post("/api/faq/notify-admin-creation", faqNotifyAdminCreation);

// ── OTP Auth ─────────────────────────────────────────────────────────────────

// ── Analytics ────────────────────────────────────────────────────────────────
app.get("/api/analytics/summary", analyticsSummary);
app.post("/api/analytics/track", analyticsTrack);

if (mode === "production") {
  configureProduction(app);
} else {
  await configureDevelopment(app);
}

const port = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : mode === "production"
    ? (config.publish?.published_port ?? config.local_port)
    : config.local_port;

export default { fetch: app.fetch, port, idleTimeout: 255 };

function configureProduction(app: Hono) {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 302));
  app.use(async (c, next) => {
    if (c.req.method !== "GET") return next();
    const path = c.req.path;
    if (path.startsWith("/api/") || path.startsWith("/assets/")) return next();
    const file = Bun.file(`./dist${path}`);
    if (await file.exists()) {
      const stat = await file.stat();
      if (stat && !stat.isDirectory()) return new Response(file);
    }
    return serveStatic({ path: "./dist/index.html" })(c, next);
  });
}

async function configureDevelopment(app: Hono): Promise<ViteDevServer> {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) return next();
    if (c.req.path === "/favicon.ico") return c.redirect("/favicon.svg", 302);

    const url = c.req.path;
    try {
      if (url === "/" || url === "/index.html") {
        let template = await Bun.file("./index.html").text();
        template = await vite.transformIndexHtml(url, template);
        return c.html(template, {
          headers: { "Cache-Control": "no-store, must-revalidate" },
        });
      }

      const publicFile = Bun.file(`./public${url}`);
      if (await publicFile.exists()) {
        const stat = await publicFile.stat();
        if (stat && !stat.isDirectory()) {
          return new Response(publicFile, {
            headers: { "Cache-Control": "no-store, must-revalidate" },
          });
        }
      }

      let result;
      try {
        result = await vite.transformRequest(url);
      } catch {
        result = null;
      }

      if (result) {
        return new Response(result.code, {
          headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-store, must-revalidate",
          },
        });
      }

      let template = await Bun.file("./index.html").text();
      template = await vite.transformIndexHtml("/", template);
      return c.html(template, {
        headers: { "Cache-Control": "no-store, must-revalidate" },
      });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error(error);
      return c.text("Internal Server Error", 500);
    }
  });

  return vite;
}
