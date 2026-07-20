import { cp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const vite = join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");

function run(args, env = {}) {
  const result = spawnSync(vite, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

// Main customer/admin application.
run(["build"]);

// Same-origin production Vendor App. API_BASE remains empty, so the browser
// calls /v1/vendor/* on the same belovediamond.com origin.
run(["build", "apps/vendor-mobile", "--config", "apps/vendor-mobile/vite.config.js"], {
  VENDOR_BASE_PATH: "/vendor/",
  VITE_DEMO_MODE: "false",
  VITE_VENDOR_API_URL: "",
  GITHUB_PAGES: "",
});

const vendorTarget = join(process.cwd(), "dist", "vendor");
await rm(vendorTarget, { recursive: true, force: true });
await mkdir(vendorTarget, { recursive: true });
await cp(join(process.cwd(), "apps", "vendor-mobile", "dist"), vendorTarget, { recursive: true });
console.log("Vendor App copied to dist/vendor/ (real API mode)");
