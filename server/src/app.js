const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const env = require("./config/env");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const { AppError } = errorHandler;

const app = express();

// Trust the first proxy (nginx). Required so req.ip reflects the real client
// and rate-limit keys aren't all the proxy's IP.
app.set("trust proxy", 1);

// Helmet: security headers. We deliberately loosen the Content Security
// Policy so inline <script> blocks in our HTML pages run. Every page here
// keeps its behaviour script inline (register.html, admin-dashboard.html,
// delivery.html, track.html, etc.), and rewriting them all to load via
// external files is disproportionate for a single-tenant self-hosted app.
//
// We still keep the bulk of Helmet's defaults (clickjacking, XSS filter,
// referrer policy, etc.) — just the CSP is relaxed.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // Allow inline scripts + eval (needed by some of our pages).
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        "script-src-attr": ["'self'", "'unsafe-inline'"],
        // Inline styles + Google Fonts CSS + Font Awesome CSS (CDN).
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        "font-src": [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "data:",
        ],
        // Images: our own uploads + anything loaded over https + data URIs.
        "img-src": ["'self'", "https:", "data:", "blob:"],
        // Allow websocket (Socket.IO) + XHR from any origin in dev.
        "connect-src": ["'self'", "ws:", "wss:", "http:", "https:"],
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}

app.use(compression());

// ═══════════════════════════════════════════════════════════════════════
// STRIPE WEBHOOK — must be mounted with raw body parsing BEFORE express.json
// Otherwise the body will have been consumed/reparsed and signature
// verification will fail. This is the #1 source of Stripe integration bugs.
// ═══════════════════════════════════════════════════════════════════════
app.use(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  require("./routes/payments.routes"),
);

// Normal JSON body for everything else
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Serve uploaded files
app.use(
  "/uploads",
  express.static(env.UPLOAD_DIR, {
    maxAge: "7d",
    fallthrough: true,
    index: false,
  }),
);

// Tight rate limit on auth endpoints. We chose 30/min as a balance between
// brute-force protection and not blocking legitimate users who mistype
// their password a couple of times during registration.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 429, message: "Too many auth requests" } },
});
app.use("/api/v1/auth", authLimiter);

// Broader API limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 429, message: "Too many requests" } },
});
app.use("/api/", apiLimiter);

// Mount the rest of the API
app.use("/api/v1", routes);

// ═══════════════════════════════════════════════════════════════════════
// FRONTEND STATIC FILES — serve HTML/CSS/JS from the project root so
// everything runs on one port.
// ═══════════════════════════════════════════════════════════════════════
const FRONTEND_DIR = path.resolve(__dirname, "../../");
app.use(
  express.static(FRONTEND_DIR, {
    index: "index.html",
    extensions: ["html"],
  }),
);

// 404 handler — only for /api/* routes. Everything else falls through to
// the static middleware above or the SPA fallback below.
app.use("/api", (req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

// Catch-all: unmatched GETs send index.html so bookmarked deep URLs work.
app.get(/.*/, (_req, res) => {
  const indexPath = path.join(FRONTEND_DIR, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) res.status(404).send("Not Found");
  });
});

// Error handler must be last.
app.use(errorHandler);

module.exports = app;
