// @ts-check
const { defineConfig, devices } = require("@playwright/test");

// Cross-browser + cross-device coverage for the static client. The same site
// is exercised on each desktop engine (Chromium/Firefox/WebKit) and on mobile
// emulations (Android Chrome, iOS Safari, and a mobile-viewport Firefox).
//
// WebKit is the engine behind Safari (macOS) and every iOS browser, so the
// `webkit` and `Mobile Safari` projects are our proxy for the Apple ecosystem
// without a Mac in the loop. Playwright manages the static server itself.

const PORT = 8799;

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: `python3 -m http.server ${PORT} --directory site`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  },
  projects: [
    // ---- Desktop engines ----
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },

    // ---- Mobile emulations ----
    { name: "chrome-android", use: { ...devices["Pixel 5"] } },
    { name: "safari-ios", use: { ...devices["iPhone 13"] } },

    // Playwright's Firefox engine does not support touch/isMobile device
    // descriptors, so this is a mobile-viewport layout check only (no touch).
    {
      name: "firefox-mobileviewport",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 412, height: 915 }
      }
    }
  ]
});
