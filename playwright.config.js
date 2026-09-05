import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  snapshotPathTemplate:"{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  fullyParallel:true,
  retries:1,
  reporter:"list",
  expect:{ toHaveScreenshot:{ threshold:0.5, maxDiffPixelRatio:0.2 } },
  use:{ baseURL:"http://127.0.0.1:3100", trace:"retain-on-failure" },
  webServer:{ command:"npm run build && npm start -- -p 3100", url:"http://127.0.0.1:3100", reuseExistingServer:true, timeout:120000 },
  projects:[{ name:"chromium", use:{ ...devices["Desktop Chrome"] } }],
});
