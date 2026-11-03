const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "./tests",
    fullyParallel: false, // flows share one backend and build on each other
    workers: 1,
    retries: 0,
    timeout: 60000,
    expect: { timeout: 10000 },
    reporter: [["list"]],
    use: {
        baseURL: "http://localhost:3100",
        channel: "chrome", // use the locally installed Chrome; no browser download needed
        locale: "mk-MK",
        timezoneId: "Europe/Skopje",
        trace: "retain-on-failure",
        screenshot: "only-on-failure"
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" }, testIgnore: /mobile\.spec\.js/ },
        { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /mobile\.spec\.js/ }
    ],
    webServer: [
        { command: "node servers/backend.js", url: "http://localhost:4100/health", reuseExistingServer: false, timeout: 30000 },
        { command: "node servers/static.js", url: "http://localhost:3100", reuseExistingServer: false, timeout: 30000 }
    ]
});
