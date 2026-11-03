import React, { useEffect, useRef, useState } from "react";
import api, { errorMessage } from "../api";
import { assetUrl } from "../config";
import { getServices } from "../salon";
import Lightbox from "./Lightbox";
import "./Services.css";

import nokti from "./nokti.png";
import nokti1 from "./nokti1.png";
import nokti2 from "./nokti2.png";
import nokti3 from "./nokti3.png";
import nokti4 from "./nokti4.png";
import nokti5 from "./nokti5.png";
import nokti6 from "./nokti6.png";
import nokti7 from "./nokti7.png";
import pedi from "./pedikir.png";
import pedi1 from "./pedi1.png";
import pedi2 from "./pedi2.png";
import lash1 from "./lash1.png";
import lash2 from "./lash2.png";
import lash3 from "./lash3.png";
import depi1 from "./depi1.png";
import depi2 from "./depi2.png";

// gallery key (backend category) -> card + built-in photos + booking category
const CATEGORIES = [
    {
        key: "Маникир",
        description: "Гел лак и наливни нокти со прецизност и долготрајност.",
        cover: nokti,
        photos: [nokti1, nokti2, nokti3, nokti, nokti4, nokti5, nokti6, nokti7],
        bookingCategory: "Маникир"
    },
    {
        key: "Педикир",
        description: "Здрави, негувани и убави стапала – со гел лак или целосен третман.",
        cover: pedi,
        photos: [pedi, pedi2, pedi1],
        bookingCategory: "Педикир"
    },
    {
        key: "Lash Lift",
        description: "Природно подигнати и нагласени трепки, без екстензии.",
        cover: lash1,
        photos: [lash1, lash2, lash3],
        bookingCategory: "Трепки и веѓи"
    },
    {
        key: "Депилација",
        description: "Нежна и ефикасна депилација за мазна кожа.",
        cover: depi1,
        photos: [depi1, depi2],
        bookingCategory: "Депилација"
    }
];

function Services({ role, galleryTick, showToast, onNavigate }) {
    const [activeKey, setActiveKey] = useState(null);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [uploaded, setUploaded] = useState({});
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const isAdmin = role === "admin";

    useEffect(() => {
        api.get("/gallery")
            .then(({ data }) => setUploaded(data || {}))
            .catch((err) => console.error("Gallery fetch error", err));
    }, [galleryTick]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [activeKey]);

    const active = CATEGORIES.find(c => c.key === activeKey);

    // newest uploads first, then the built-in photos
    const photos = active
        ? [
            ...[...(uploaded[active.key] || [])].reverse().map(path => ({ src: assetUrl(path), path })),
            ...active.photos.map(src => ({ src, path: null }))
        ]
        : [];

    const book = (serviceName) => {
        if (serviceName) sessionStorage.setItem("bq:preselectService", serviceName);
        onNavigate?.("termin");
    };

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length) return;

        setUploading(true);
        try {
            for (const file of files) {
                const form = new FormData();
                form.append("category", active.key);
                form.append("image", file);
                const { data } = await api.post("/upload", form);
                setUploaded(prev => ({ ...prev, [active.key]: [...(prev[active.key] || []), data.imagePath] }));
            }
            showToast?.({ type: "accepted", title: "Сликите се додадени", message: `${files.length} во ${active.key}` });
        } catch (err) {
            showToast?.({ type: "error", title: "Грешка при прикачување", message: errorMessage(err) });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (imagePath) => {
        if (!window.confirm("Да се избрише сликата од галеријата?")) return;
        try {
            await api.delete("/delete-image", { data: { imagePath } });
            setUploaded(prev => ({ ...prev, [active.key]: (prev[active.key] || []).filter(p => p !== imagePath) }));
        } catch (err) {
            showToast?.({ type: "error", title: "Грешка", message: errorMessage(err) });
        }
    };

    return (
        <div className="services-page">
            <section className="services-hero">
                <span className="services-kicker">Beauty Queen Studio</span>
                <h1>Нашите услуги</h1>
                <p>Убавината не е луксуз. Таа е грижа, внимание и малку магија.</p>
                <div className="services-values">
                    {["Квалитет", "Хигиена", "Искуство", "Елеганција"].map((t, idx) => (
                        <span key={t} style={{ animationDelay: `${idx * 0.12}s` }}>{t}</span>
                    ))}
                </div>
            </section>

            {!active ? (
                <section className="services-grid">
                    {CATEGORIES.map(cat => {
                        const items = getServices().filter(s => s.category === cat.bookingCategory);
                        const count = cat.photos.length + (uploaded[cat.key]?.length || 0);
                        return (
                            <article key={cat.key} className="service-card">
                                <button className="service-card-cover" onClick={() => setActiveKey(cat.key)}>
                                    <img src={cat.cover} alt={cat.key} loading="lazy" />
                                    <span className="service-card-photos">📷 {count} слики</span>
                                </button>
                                <div className="service-card-body">
                                    <h3>{cat.key === "Lash Lift" ? "Трепки и веѓи" : cat.key}</h3>
                                    <p>{cat.description}</p>
                                    <ul className="service-card-list">
                                        {items.map(s => (
                                            <li key={s.name}>
                                                <span>{s.name}</span>
                                                <span className="service-card-duration">{s.duration} мин</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="service-card-actions">
                                        <button className="bq-btn bq-btn-ghost" onClick={() => setActiveKey(cat.key)}>Галерија</button>
                                        {!isAdmin && (
                                            <button className="bq-btn bq-btn-primary" onClick={() => book(items[0]?.name)}>Закажи</button>
                                        )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </section>
            ) : (
                <section className="gallery-section">
                    <div className="gallery-header">
                        <button className="bq-btn bq-btn-ghost" onClick={() => setActiveKey(null)}>← Сите услуги</button>
                        <h2>{active.key}</h2>
                        <div className="gallery-header-actions">
                            {isAdmin ? (
                                <>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleUpload}
                                        hidden
                                    />
                                    <button
                                        className="bq-btn bq-btn-primary"
                                        disabled={uploading}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {uploading ? "Се прикачува…" : "📷 Додај слики"}
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="bq-btn bq-btn-primary"
                                    onClick={() => book(getServices().find(s => s.category === active.bookingCategory)?.name)}
                                >
                                    Закажи термин
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="gallery-grid">
                        {photos.map(({ src, path }, idx) => (
                            <div key={`${src}-${idx}`} className="gallery-item">
                                <button className="gallery-thumb" onClick={() => setLightboxIndex(idx)} aria-label={`Отвори слика ${idx + 1}`}>
                                    <img src={src} alt={`${active.key} ${idx + 1}`} loading="lazy" />
                                </button>
                                {isAdmin && path && (
                                    <button className="gallery-delete" onClick={() => handleDelete(path)} title="Избриши слика">
                                        🗑️
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {active && lightboxIndex !== null && photos.length > 0 && (
                <Lightbox
                    images={photos.map(p => p.src)}
                    index={Math.min(lightboxIndex, photos.length - 1)}
                    onIndexChange={setLightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    caption={active.key}
                />
            )}

            <section className="services-cta">
                <a href={`https://www.instagram.com/_beautyqueenstudio_/`} target="_blank" rel="noopener noreferrer">
                    Повеќе од нашата работа на Instagram →
                </a>
            </section>
        </div>
    );
}

export default Services;
