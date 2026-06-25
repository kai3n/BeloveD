import { createApp } from "./app.js";
import { closePool } from "./db.js";

const port = Number(process.env.API_PORT || 8787);
const app = createApp();
const server = app.listen(port, () => {
  console.log(`BeloveDiamond API on http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => closePool().finally(() => process.exit(0)));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
