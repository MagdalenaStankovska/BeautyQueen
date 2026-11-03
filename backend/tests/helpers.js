const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const { createApp } = require("../app");

const tmpDirs = [];

function makeDataDir(files = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bq-test-"));
    tmpDirs.push(dir);
    Object.entries(files).forEach(([name, content]) =>
        fs.writeFileSync(path.join(dir, name), typeof content === "string" ? content : JSON.stringify(content)));
    return dir;
}

function cleanupDataDirs() {
    tmpDirs.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true }));
}

const readJson = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));

function buildApp(opts = {}) {
    const dataDir = opts.dataDir || makeDataDir(opts.files);
    const pushed = [];
    const instance = createApp({
        dataDir,
        quiet: true,
        adminEmails: "admin@test.mk",
        rateLimitMax: 10000,
        logger: { log() {}, error() {} },
        pushSender: async (sub, payload) => { pushed.push({ sub, payload: JSON.parse(payload) }); },
        ...opts.options
    });
    return { ...instance, dataDir, pushed, api: request(instance.app) };
}

// Next date (YYYY-MM-DD) at least `minDays` ahead that falls on one of `weekdays` (0 = Sunday).
function nextDate(weekdays = [1, 2, 3, 4, 5], minDays = 2) {
    const d = new Date();
    d.setDate(d.getDate() + minDays);
    while (!weekdays.includes(d.getDay())) d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("sv-SE");
}

async function registerAndLogin(api, { email, password = "secret1", name = "", phone = "" }) {
    await api.post("/register").send({ email, password, name, phone });
    const res = await api.post("/login").send({ email, password });
    return res.body.token;
}

module.exports = { makeDataDir, cleanupDataDirs, readJson, buildApp, nextDate, registerAndLogin };
