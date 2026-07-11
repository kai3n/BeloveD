import { createApp } from "./app.js";
import { closePool } from "./db.js";

const port = Number(process.env.API_PORT || 8787);
// The non-production media fallback accepts anonymous binary uploads for the
// intake flow. Keep the standalone dev API on loopback unless a developer opts
// into LAN access explicitly; production containers still bind all interfaces.
const host = process.env.API_HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const app = createApp();
const server = app.listen(port, host, () => {
  console.log(`BeloveDiamond API on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => closePool().finally(() => process.exit(0)));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
