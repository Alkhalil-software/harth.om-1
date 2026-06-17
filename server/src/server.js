const http = require("http");
const env = require("./config/env");
const app = require("./app");
const knex = require("./db");
const bootstrapAdmin = require("./utils/bootstrap-admin");
const realtime = require("./services/realtime.service");

async function start() {
  try {
    await knex.raw("select 1");
    // eslint-disable-next-line no-console
    console.log("✅ Database connected");

    await bootstrapAdmin();

    // Wrap the Express app in a raw HTTP server so Socket.IO can share the port.
    const httpServer = http.createServer(app);

    // Install realtime layer. From now on notificationService/messageController
    // can push events via realtime.emitToUser(...).
    realtime.initialize(httpServer);
    // eslint-disable-next-line no-console
    console.log("✅ Realtime (Socket.IO) initialized");

    httpServer.listen(env.PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`🚀 Server running at http://localhost:${env.PORT}`);
      // eslint-disable-next-line no-console
      console.log(`   Health: http://localhost:${env.PORT}/api/v1/health`);
      // eslint-disable-next-line no-console
      console.log(`   Socket.IO:  ws://localhost:${env.PORT}/socket.io/`);
    });

    const shutdown = async (signal) => {
      // eslint-disable-next-line no-console
      console.log(`\n${signal} received — shutting down gracefully`);
      httpServer.close(async () => {
        try {
          await knex.destroy();
          // eslint-disable-next-line no-console
          console.log("✅ DB pool closed");
          process.exit(0);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Error during shutdown:", e);
          process.exit(1);
        }
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

start();
