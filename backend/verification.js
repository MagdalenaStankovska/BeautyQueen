// One-time codes for confirming that an e-mail address or phone number belongs to the user
// (registration and password reset). Codes are 6 digits, stored only as an HMAC, expire after
// CODE_TTL_MINUTES and are invalidated after MAX_ATTEMPTS wrong guesses.

const crypto = require("crypto");

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5; // per destination, so nobody can use the salon to spam an inbox/phone

// "070 283 453", "0038970283453", "+389 70-283-453" -> "+38970283453". Local numbers default to North Macedonia.
function normalizePhone(raw, defaultCountry = "389") {
    if (typeof raw !== "string" && typeof raw !== "number") return "";
    let p = String(raw).trim().replace(/[\s\-()./]/g, "");
    if (p.startsWith("00")) p = `+${p.slice(2)}`;
    else if (p.startsWith("0")) p = `+${defaultCountry}${p.slice(1)}`;
    else if (/^\d/.test(p) && p.startsWith(defaultCountry)) p = `+${p}`;
    return /^\+[1-9]\d{7,14}$/.test(p) ? p : "";
}

const maskEmail = (email) => {
    const [user, domain] = email.split("@");
    return `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
};
const maskPhone = (phone) => `${phone.slice(0, 4)}${"•".repeat(Math.max(1, phone.length - 7))}${phone.slice(-3)}`;

/* ---------- senders ---------- */

function emailContent(code, purpose, salonName) {
    const what = purpose === "reset" ? "промена на лозинката" : "потврда на вашата сметка";
    const subject = purpose === "reset" ? `${salonName} – код за нова лозинка` : `${salonName} – код за потврда`;
    const text = `Вашиот код за ${what} е: ${code}\n\nКодот важи ${CODE_TTL_MINUTES} минути. Ако не сте го побарале вие, игнорирајте ја оваа порака.\n\n${salonName}`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#3a2a33">
<h2 style="color:#b0457b;margin:0 0 12px">${salonName}</h2>
<p>Вашиот код за ${what} е:</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#fbeef4;padding:14px;text-align:center;border-radius:10px">${code}</p>
<p style="font-size:13px;color:#7a6570">Кодот важи ${CODE_TTL_MINUTES} минути. Ако не сте го побарале вие, игнорирајте ја оваа порака.</p>
</div>`;
    return { subject, text, html };
}

// SMTP works with any provider: Gmail (app password), Brevo, Mailgun, Amazon SES, Resend…
function createEmailSender(env) {
    if (!env.SMTP_HOST || !env.MAIL_FROM) return null;
    const nodemailer = require("nodemailer");
    const port = Number(env.SMTP_PORT) || 587;
    const transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
    });
    return ({ to, subject, text, html }) => transport.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
}

// Twilio Programmable Messaging over plain HTTPS (no SDK). TWILIO_FROM may be a number, an
// alphanumeric sender ("BeautyQueen") or a Messaging Service SID (MG…).
function createSmsSender(env) {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = env;
    if (!sid || !token || !from) return null;
    return async ({ to, text }) => {
        const body = new URLSearchParams({ To: to, Body: text });
        body.set(from.startsWith("MG") ? "MessagingServiceSid" : "From", from);
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: "POST",
            headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
            body
        });
        if (!res.ok) {
            const err = new Error(`Twilio ${res.status}: ${await res.text()}`);
            err.statusCode = res.status;
            throw err;
        }
    };
}

/* ---------- code store ---------- */

function createVerifier({ secret, salonName, env = process.env, isProduction, codeSender, log = console, now = () => Date.now() }) {
    const email = createEmailSender(env);
    const sms = createSmsSender(env);
    const channels = { email: Boolean(codeSender || email), sms: Boolean(codeSender || sms) };
    // Without a real provider (local development) codes are printed and returned to the client so the flow can be tested.
    const devMode = !codeSender && !email && !isProduction;
    if (devMode) channels.email = true;

    const entries = new Map(); // `${purpose}:${email}` -> entry
    const sendLog = new Map(); // destination -> [timestamps]

    const hash = (code) => crypto.createHmac("sha256", secret).update(String(code)).digest("hex");
    const key = (purpose, id) => `${purpose}:${id}`;

    function prune() {
        const t = now();
        for (const [k, e] of entries) if (e.expiresAt < t) entries.delete(k);
        for (const [d, list] of sendLog) {
            const recent = list.filter(ts => t - ts < 3600000);
            if (recent.length) sendLog.set(d, recent); else sendLog.delete(d);
        }
    }

    async function deliver(channel, to, code, purpose) {
        const content = emailContent(code, purpose, salonName);
        if (codeSender) return codeSender({ channel, to, code, purpose, ...content });
        if (channel === "sms") {
            const what = purpose === "reset" ? "nova lozinka" : "potvrda na smetka";
            return sms({ to, text: `${salonName}: kod za ${what}: ${code}. Vazi ${CODE_TTL_MINUTES} min.` });
        }
        if (email) return email({ to, ...content });
        log.log(`[dev] ${purpose} code for ${to}: ${code}`);
    }

    // Returns { ok, status, message, ... }. `data` is kept with the entry (e.g. the pending registration).
    async function send({ purpose, id, channel, to, data }) {
        prune();
        if (!channels[channel]) return { ok: false, status: 400, message: "Овој начин на потврда не е достапен" };

        const k = key(purpose, id);
        const existing = entries.get(k);
        const t = now();
        if (existing && t - existing.sentAt < RESEND_COOLDOWN_SECONDS * 1000) {
            const wait = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - (t - existing.sentAt)) / 1000);
            return { ok: false, status: 429, message: `Почекајте ${wait} секунди пред да побарате нов код`, retryAfter: wait };
        }
        const sent = sendLog.get(to) || [];
        if (sent.length >= MAX_SENDS_PER_HOUR)
            return { ok: false, status: 429, message: "Премногу испратени кодови. Обидете се повторно за еден час." };

        const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
        try {
            await deliver(channel, to, code, purpose);
        } catch (err) {
            log.error("Code delivery failed", channel, err.message);
            return { ok: false, status: 502, message: channel === "sms" ? "SMS пораката не може да се испрати. Проверете го бројот." : "Е-поштата не може да се испрати. Обидете се повторно." };
        }
        sendLog.set(to, [...sent, t]);
        entries.set(k, { codeHash: hash(code), channel, to, data, attempts: 0, sentAt: t, expiresAt: t + CODE_TTL_MINUTES * 60000 });

        return {
            ok: true,
            channel,
            destination: channel === "sms" ? maskPhone(to) : maskEmail(to),
            resendAfter: RESEND_COOLDOWN_SECONDS,
            ...(devMode ? { devCode: code } : {})
        };
    }

    // Synchronous on purpose: check + consume happen in one tick, so a code can't be used twice concurrently.
    function check({ purpose, id, code }) {
        const k = key(purpose, id);
        const entry = entries.get(k);
        if (!entry || entry.expiresAt < now()) {
            entries.delete(k);
            return { ok: false, status: 400, message: "Кодот истече или не постои. Побарајте нов код." };
        }
        const given = Buffer.from(hash(String(code ?? "").trim()), "hex");
        if (!crypto.timingSafeEqual(given, Buffer.from(entry.codeHash, "hex"))) {
            entry.attempts += 1;
            if (entry.attempts >= MAX_ATTEMPTS) {
                entries.delete(k);
                return { ok: false, status: 400, message: "Премногу погрешни обиди. Побарајте нов код." };
            }
            return { ok: false, status: 400, message: `Погрешен код. Преостануваат ${MAX_ATTEMPTS - entry.attempts} обиди.` };
        }
        entries.delete(k);
        return { ok: true, channel: entry.channel, to: entry.to, data: entry.data };
    }

    const peek = (purpose, id) => entries.get(key(purpose, id)) || null;

    return { send, check, peek, channels, devMode };
}

module.exports = { createVerifier, normalizePhone, maskEmail, maskPhone, CODE_TTL_MINUTES, MAX_ATTEMPTS, RESEND_COOLDOWN_SECONDS };
