// Starts the real API on a throw-away data directory for end-to-end tests.
process.env.TZ = process.env.TZ || "Europe/Skopje";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { createApp } = require("../../backend/app");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bq-e2e-"));
const instance = createApp({
    dataDir,
    quiet: true,
    adminEmails: "admin@e2e.mk",
    rateLimitMax: 10000,
    pushSender: async () => {}
});

instance.start(Number(process.env.E2E_API_PORT) || 4100).then(port => console.log(`e2e API on ${port}, data in ${dataDir}`));

const stop = async () => {
    await instance.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
