require("dotenv").config({ quiet: true });
// Salon time zone — appointment date/time strings are interpreted as local salon time.
process.env.TZ = process.env.TZ || "Europe/Skopje";

const { createApp } = require("./app");

const PORT = Number(process.env.PORT) || 4000;

let instance;
try {
    instance = createApp();
} catch (err) {
    console.error(`❌ Cannot start: ${err.message}`);
    process.exit(1);
}

instance.start(PORT).then(
    (port) => console.log(`✅ Beauty Queen API running on http://localhost:${port} (${process.env.NODE_ENV || "development"})`),
    (err) => {
        console.error(`❌ Cannot listen on port ${PORT}: ${err.message}`);
        process.exit(1);
    }
);

// Graceful shutdown: stop timers, close sockets and in-flight connections, then exit.
let shuttingDown = false;
const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down…`);
    const force = setTimeout(() => process.exit(1), 10000);
    force.unref();
    await instance.close();
    process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));
