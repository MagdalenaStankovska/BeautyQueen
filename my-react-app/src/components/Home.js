import React, { useEffect, useState } from "react";
import api from "../api";
import {
    appointmentDate,
    dayHours,
    employeeLabel,
    formatFriendlyDate,
    formatLocalDate,
    getServices,
    salon,
    serviceGroups,
    statusLabels,
    weekdayNames
} from "../salon";
import "./Home.css";

import heroImg from "./biseri1.png";
import vaucher from "./1.jpg";
import gintonik from "./gintonik.png";
import kolagen from "./kolagen.png";
import salon1 from "./salon1.png";
import salon2 from "./salon2.png";
import nokti from "./nokti3.png";
import pedi from "./pedikir.png";
import lash from "./lash2.png";
import depi from "./depi1.png";

const categoryImages = { "Маникир": nokti, "Педикир": pedi, "Трепки и веѓи": lash, "Депилација": depi };

const highlights = [
    { icon: "✨", title: "Квалитет", text: "Врвни материјали и препарати за долготраен резултат." },
    { icon: "🧼", title: "Хигиена", text: "Стерилизирани инструменти и чист простор за секој клиент." },
    { icon: "💅", title: "Искуство", text: "Тим со долгогодишно искуство и постојана едукација." },
    { icon: "👑", title: "Атмосфера", text: "Пијалак добредојде и опуштено, Pinktastic чувство." }
];

const offers = [
    { img: gintonik, tag: "Искуство", title: "Gin & Tonic искуство", text: "Убави моменти и уникатна услуга за секоја наша Beauty Queen." },
    { img: vaucher, tag: "Подарок", title: "Подари ваучер", text: "Ваучер за било која услуга, во било која вредност – совршен подарок за најблиските." },
    { img: kolagen, tag: "Ново", title: "Педикир со кристален колаген", text: "Совршени нокти и нега за стапалата со долготраен ефект." }
];

// Monday-first list of opening hours, with consecutive identical days merged ("Понеделник – Петок").
const hoursRows = () => {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const rows = [];
    order.forEach(day => {
        const h = salon().hours[day];
        const label = h ? `${h.open} – ${h.close}` : "Затворено";
        const last = rows[rows.length - 1];
        if (last && last.label === label) last.to = day;
        else rows.push({ from: day, to: day, label });
    });
    return rows.map(r => ({
        days: r.from === r.to ? weekdayNames[r.from] : `${weekdayNames[r.from]} – ${weekdayNames[r.to]}`,
        label: r.label
    }));
};

function Home({ role, user, syncTick, onNavigate }) {
    const [nextAppt, setNextAppt] = useState(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [todayCount, setTodayCount] = useState(0);
    const cfg = salon();
    const isAdmin = role === "admin";

    useEffect(() => {
        const now = new Date();
        if (isAdmin) {
            api.get("/appointments")
                .then(({ data }) => {
                    setPendingCount(data.filter(a => a.status === "pending").length);
                    const today = formatLocalDate(now);
                    setTodayCount(data.filter(a => a.status === "accepted" && a.date === today).length);
                })
                .catch(() => {});
        } else {
            api.get("/appointments/user")
                .then(({ data }) => {
                    const upcoming = data
                        .filter(a => (a.status === "accepted" || a.status === "pending") && appointmentDate(a) > now)
                        .sort((a, b) => appointmentDate(a) - appointmentDate(b));
                    setNextAppt(upcoming[0] || null);
                })
                .catch(() => {});
        }
    }, [isAdmin, syncTick]);

    const book = (serviceName) => {
        if (serviceName) sessionStorage.setItem("bq:preselectService", serviceName);
        onNavigate("termin");
    };

    const todayHours = dayHours(formatLocalDate(new Date()));
    const firstName = (user?.name || "").split(" ")[0];
    const telHref = `tel:${cfg.phone.replace(/\s/g, "")}`;
    const mapQuery = encodeURIComponent(cfg.address);

    return (
        <div className="home">
            {/* HERO */}
            <section className="home-hero" style={{ backgroundImage: `url(${heroImg})` }}>
                <div className="home-hero-overlay" />
                <div className="home-hero-content">
                    <span className="home-kicker">Beauty Queen Studio · Скопје</span>
                    <h1>{firstName ? `Добредојдовте, ${firstName}!` : "Добредојдовте во Beauty Queen Studio"}</h1>
                    <p>Нашата Pinktastic енергија е тука за вашата убавина. Закажете термин за неколку секунди.</p>
                    <div className="home-hero-actions">
                        <button className="home-btn home-btn-primary" onClick={() => onNavigate("termin")}>
                            {isAdmin ? "Отвори распоред" : "Закажи термин"}
                        </button>
                        <button className="home-btn home-btn-light" onClick={() => onNavigate("услуги")}>
                            Погледни услуги
                        </button>
                    </div>
                    <div className="home-hero-meta">
                        <span className={`home-open-dot ${todayHours ? "open" : "closed"}`} />
                        {todayHours ? `Денес отворено ${todayHours.open} – ${todayHours.close}` : "Денес не работиме"}
                        <span className="home-meta-sep">·</span>
                        <a href={telHref}>{cfg.phone}</a>
                    </div>
                </div>
            </section>

            {/* PERSONAL CARD */}
            {isAdmin ? (
                <section className="home-personal" onClick={() => onNavigate("termin")}>
                    <div>
                        <span className="home-personal-label">Преглед за денес</span>
                        <strong>{pendingCount} {pendingCount === 1 ? "ново барање" : "нови барања"} · {todayCount} термини денес</strong>
                    </div>
                    <span className="home-personal-arrow">→</span>
                </section>
            ) : nextAppt ? (
                <section className="home-personal" onClick={() => onNavigate("termin")}>
                    <div>
                        <span className="home-personal-label">Вашиот следен термин</span>
                        <strong>{nextAppt.service}</strong>
                        <span>
                            {formatFriendlyDate(nextAppt.date)} во {nextAppt.time}
                            {nextAppt.employee ? ` · ${employeeLabel(nextAppt.employee)}` : ""}
                        </span>
                    </div>
                    <span className={`home-personal-status status-${nextAppt.status}`}>{statusLabels[nextAppt.status]}</span>
                </section>
            ) : null}

            {/* SERVICES MENU */}
            <section className="home-section">
                <div className="home-section-head">
                    <span className="home-kicker dark">Мени</span>
                    <h2>Нашите услуги</h2>
                    <p>Изберете услуга и закажете директно – времетраењето е прикажано за секоја услуга.</p>
                </div>
                <div className="home-menu">
                    {Object.entries(serviceGroups()).map(([category, names]) => (
                        <article key={category} className="home-menu-card">
                            <div className="home-menu-img" style={{ backgroundImage: `url(${categoryImages[category] || nokti})` }} />
                            <div className="home-menu-body">
                                <h3>{category}</h3>
                                <ul>
                                    {names.map(name => {
                                        const svc = getServices().find(s => s.name === name);
                                        return (
                                            <li key={name}>
                                                <span className="home-menu-name">{name}</span>
                                                <span className="home-menu-dur">{svc.duration} мин</span>
                                                {!isAdmin && (
                                                    <button className="home-menu-book" onClick={() => book(name)} aria-label={`Закажи ${name}`}>
                                                        Закажи
                                                    </button>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {/* HIGHLIGHTS */}
            <section className="home-highlights">
                {highlights.map(h => (
                    <div key={h.title} className="home-highlight">
                        <span className="home-highlight-icon">{h.icon}</span>
                        <h4>{h.title}</h4>
                        <p>{h.text}</p>
                    </div>
                ))}
            </section>

            {/* OFFERS */}
            <section className="home-section">
                <div className="home-section-head">
                    <span className="home-kicker dark">Специјално</span>
                    <h2>Издвојуваме</h2>
                </div>
                <div className="home-offers">
                    {offers.map(o => (
                        <article key={o.title} className="home-offer">
                            <div className="home-offer-img">
                                <img src={o.img} alt={o.title} loading="lazy" />
                                <span className="home-offer-tag">{o.tag}</span>
                            </div>
                            <h3>{o.title}</h3>
                            <p>{o.text}</p>
                        </article>
                    ))}
                </div>
            </section>

            {/* ABOUT */}
            <section className="home-about">
                <div className="home-about-images">
                    <img src={salon1} alt="Салонот Beauty Queen" />
                    <img src={salon2} alt="Ентериер на салонот" />
                </div>
                <div className="home-about-text">
                    <span className="home-kicker dark">За нас</span>
                    <h2>Нашата Pinktastic енергија</h2>
                    <p>
                        Секој посетител го третираме како кралица. Придружете ни се на пијалак, закажете термин и
                        уживајте во уникатната атмосфера на Beauty Queen Studio.
                    </p>
                    <button className="home-btn home-btn-outline" onClick={() => onNavigate("tim")}>Запознај го тимот</button>
                </div>
            </section>

            {/* VISIT */}
            <section className="home-visit">
                <div className="home-visit-info">
                    <span className="home-kicker dark">Посетете не</span>
                    <h2>Локација и контакт</h2>

                    <div className="home-info-block">
                        <h4>📍 Адреса</h4>
                        <p>{cfg.address}</p>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer">
                            Насоки до салонот →
                        </a>
                    </div>

                    <div className="home-info-block">
                        <h4>🕒 Работно време</h4>
                        <table className="home-hours">
                            <tbody>
                                {hoursRows().map(r => (
                                    <tr key={r.days}>
                                        <td>{r.days}</td>
                                        <td className={r.label === "Затворено" ? "closed" : ""}>{r.label}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="home-info-block">
                        <h4>📞 Контакт</h4>
                        <div className="home-contact-links">
                            <a className="home-contact-chip" href={telHref}>Јави се</a>
                            <a className="home-contact-chip" href={`mailto:${cfg.email}`}>Е-пошта</a>
                            <a className="home-contact-chip" href={cfg.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
                        </div>
                    </div>
                </div>
                <iframe
                    className="home-map"
                    title="Локација на Beauty Queen Studio"
                    src={`https://maps.google.com/maps?q=${mapQuery}&z=16&output=embed`}
                    loading="lazy"
                    allowFullScreen
                />
            </section>

            {!isAdmin && (
                <section className="home-final-cta">
                    <h2>Подготвени за нов изглед?</h2>
                    <p>Изберете термин што ви одговара – ќе добиете потврда и потсетник пред терминот.</p>
                    <button className="home-btn home-btn-primary" onClick={() => onNavigate("termin")}>Закажи термин</button>
                </section>
            )}

            <footer className="home-footer">
                © {new Date().getFullYear()} {cfg.name} · {cfg.address}
            </footer>
        </div>
    );
}

export default Home;
