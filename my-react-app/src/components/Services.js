import React, { useState } from "react";
import nokti from "./nokti.png";
import pedi from "./pedikir.png";
import lash from "./lash1.png";
import depi from "./depi1.png";

// Маникир слики
import nokti1 from "./nokti1.png";
import nokti2 from "./nokti2.png";
import nokti3 from "./nokti3.png";
import nokti4 from "./nokti4.png";
import nokti5 from "./nokti5.png";
import nokti6 from "./nokti6.png";
import nokti7 from "./nokti7.png";

// Педикир слики
import pedi1 from "./pedi1.png";
import pedi2 from "./pedi2.png";

// Lash Lift слики
import lash1 from "./lash1.png";
import lash2 from "./lash2.png";
import lash3 from "./lash3.png";

// Депилација слики
import depi1 from "./depi1.png";
import depi2 from "./depi2.png";

function Services() {
    const [viewGallery, setViewGallery] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);

    const font = "'Poiret One', sans-serif";

    const cards = [
        { title: "Маникир", description: "Професионален маникир со долгогодишно искуство." },
        { title: "Педикир", description: "Убав педикир за здрави и негувани нозе." },
        { title: "Lash Lift", description: "Нагласете ги вашите трепки на природен начин." },
        { title: "Депилација", description: "Нежна и ефикасна нега на вашата кожа." },
    ];

    const manicureGallery = [nokti1, nokti2, nokti3, nokti, nokti4, nokti5, nokti6, nokti7];
    const pedikirGallery = [pedi, pedi2, pedi1];
    const lashGallery = [lash1, lash2, lash3];
    const depilationGallery = [depi1, depi2];

    const getGallery = () => {
        switch (viewGallery) {
            case "Маникир": return manicureGallery;
            case "Педикир": return pedikirGallery;
            case "Lash Lift": return lashGallery;
            case "Депилација": return depilationGallery;
            default: return [];
        }
    };

    return (
        <>
            <style>
                {`@import url('https://fonts.googleapis.com/css2?family=Poiret+One&display=swap');

                @keyframes fadeUpSmooth {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                `}
            </style>

            {/* ===== INTRO ===== */}
            <section style={{
                padding: "80px 20px",
                background: "linear-gradient(to bottom, #fff0f5, #ffe6ef)",
                textAlign: "center"
            }}>
                <h1 style={{ fontFamily: font, color: "palevioletred", fontSize: "42px", marginBottom: "15px" }}>
                    Нашите услуги
                </h1>
                <p style={{ maxWidth: "600px", margin: "0 auto 30px", color: "#555", fontSize: "16px" }}>
                    Убавината не е луксуз. Таа е грижа, внимание и малку магија.
                </p>

                <div style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "20px",
                    marginTop: "20px",
                    flexWrap: "wrap"
                }}>
                    {["Квалитет", "Хигиена", "Искуство", "Елеганција"].map((t, idx) => (
                        <div key={idx} style={{
                            padding: "12px 24px",
                            borderRadius: "30px",
                            backgroundColor: ["#ffc1cc", "#ffb3c6", "#ff99b3", "#ffa6b9"][idx % 4],
                            boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                            fontFamily: font,
                            color: "#222",
                            opacity: 0,
                            transform: "translateY(20px)",
                            animation: `fadeUpSmooth 0.8s ease forwards`,
                            animationDelay: `${idx * 0.25}s`
                        }}>
                            {t}
                        </div>
                    ))}
                </div>

                {/* Instagram копче */}
                <a
                    href="https://www.instagram.com/_beautyqueenstudio_/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: "inline-block",
                        marginTop: "50px",
                        padding: "12px 28px",
                        background: "linear-gradient(45deg, #ff6ec4, #f883ff)",
                        color: "white",
                        borderRadius: "30px",
                        fontFamily: font,
                        fontSize: "16px",
                        textDecoration: "none",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
                        transition: "transform 0.3s ease, box-shadow 0.3s ease"
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.transform = "scale(1.05)";
                        e.currentTarget.style.boxShadow = "0 12px 25px rgba(0,0,0,0.2)";
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.15)";
                    }}
                >
                    Посети Instagram
                </a>
            </section>

            {/* ===== SERVICES / GALLERY ===== */}
            {viewGallery ? (
                <section style={{ padding: "50px", backgroundColor: "#fff0f5" }}>
                    <button
                        onClick={() => setViewGallery(null)}
                        style={{
                            marginBottom: "30px",
                            padding: "10px 22px",
                            backgroundColor: "palevioletred",
                            color: "white",
                            border: "none",
                            borderRadius: "10px",
                            cursor: "pointer",
                            fontFamily: font,
                        }}
                    >
                        ← Назад
                    </button>

                    <h2 style={{ fontFamily: font, color: "palevioletred", marginBottom: "30px" }}>
                        Галерија: {viewGallery}
                    </h2>

                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                        gap: "24px"
                    }}>
                        {getGallery().map((src, idx) => (
                            <img
                                key={idx}
                                src={src}
                                alt=""
                                onClick={() => setSelectedImage(src)}
                                style={{
                                    width: "100%",
                                    height: "220px",
                                    objectFit: "cover",
                                    borderRadius: "16px",
                                    cursor: "pointer",
                                    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                                    transition: "transform 0.3s ease"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.06)"}
                                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                            />
                        ))}
                    </div>
                </section>
            ) : (
                <section style={{ padding: "80px 40px", backgroundColor: "#fff0f5" }}>
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "30px"
                    }}>
                        {cards.map(({ title, description }) => {
                            const bg =
                                title === "Маникир" ? nokti :
                                    title === "Педикир" ? pedi :
                                        title === "Lash Lift" ? lash : depi;

                            return (
                                <div
                                    key={title}
                                    onClick={() => setViewGallery(title)}
                                    style={{
                                        height: "320px",
                                        borderRadius: "20px",
                                        overflow: "hidden",
                                        cursor: "pointer",
                                        position: "relative",
                                        boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
                                        fontFamily: font,
                                        transition: "transform 0.35s ease"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-8px)"}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                                >
                                    <div style={{
                                        position: "absolute",
                                        inset: 0,
                                        backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.25)), url(${bg})`,
                                        opacity: "85%",
                                        backgroundSize: "cover",
                                        backgroundPosition: "center"
                                    }} />

                                    <div style={{
                                        position: "absolute",
                                        bottom: "20px",
                                        padding: "20px",
                                        color: "white"
                                    }}>
                                        <h3 style={{ marginBottom: "10px" }}>{title}</h3>
                                        <p style={{ fontFamily: "Arial", fontSize: "14px" }}>
                                            {description}
                                        </p>
                                        <span style={{
                                            display: "inline-block",
                                            marginTop: "10px",
                                            padding: "6px 14px",
                                            borderRadius: "20px",
                                            backgroundColor: "palevioletred",
                                            fontSize: "12px"
                                        }}>
                                            Погледни галерија
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ===== FULLSCREEN IMAGE ===== */}
            {selectedImage && (
                <div
                    onClick={() => setSelectedImage(null)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 3000
                    }}
                >
                    <img
                        src={selectedImage}
                        alt=""
                        style={{
                            maxWidth: "90%",
                            maxHeight: "90%",
                            borderRadius: "18px",
                            boxShadow: "0 10px 40px rgba(0,0,0,0.5)"
                        }}
                    />
                </div>
            )}
        </>
    );
}

export default Services;
