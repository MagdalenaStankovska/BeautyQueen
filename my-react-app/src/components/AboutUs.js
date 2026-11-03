import React, { useEffect, useState } from "react";
import saraImg from "./sara.jpg";
import marijaImg from "./marija.png";

const AboutUs = () => {
    const titleStyle = {
        fontFamily: "'Poiret One', cursive",
        color: "#bf4f87",
        textAlign: "center",
        marginBottom: "20px",
        textShadow: "0 8px 16px rgba(182, 70, 128, 0.16)",
    };

    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setVisible(true), 200);
        return () => clearTimeout(id);
    }, []);

    const cardStyleBase = {
        width: "230px",
        borderRadius: "18px",
        background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,240,248,0.92))",
        padding: "16px",
        textAlign: "center",
        border: "1px solid rgba(255,255,255,0.84)",
        boxShadow: "0 14px 28px rgba(149, 53, 102, 0.18)",
        transition: "transform 0.3s, box-shadow 0.3s, opacity 0.6s, transform 0.6s",
        cursor: "pointer",
        opacity: 0,
        transform: "translateY(30px)",
    };

    const cardHover = (e) => {
        e.currentTarget.style.transform = "scale(1.05)";
        e.currentTarget.style.boxShadow = "0 18px 34px rgba(0,0,0,0.2)";
    };

    const cardLeave = (e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 14px 28px rgba(149, 53, 102, 0.18)";
    };

    const members = [
        { name: "Сара", role: "Стилист за коса", desc: "Секогаш создава уникатни фризури со страст и креативност.", img: saraImg, instagram: "https://www.instagram.com/smiiilkovskaa?igsh=MW0xM3h5MjcxbmZ2aA==" },
        // TODO: add Izabela's photo, role, description and Instagram once received
        { name: "Изабела", role: "Член на тимот", desc: "Најновиот член на нашиот тим – ве очекува со насмевка.", img: null, instagram: null },
        { name: "Марија", role: "Сопственик / Координатор", desc: "Го води тимот со посветеност и љубов кон клиентите.", img: marijaImg, instagram: "https://www.instagram.com/stankovskaa?igsh=ejVpMWNzOXlmdW9h" },
    ];

    return (
        <div style={{
            padding: "50px 20px",
            maxWidth: "1000px",
            margin: "0 auto",
            textAlign: "center",
            background: "linear-gradient(180deg, #fff7fb, #ffedf7)",
            borderRadius: "18px"
        }}>
            {/* Голема слика на целиот тим */}
            {/* Голема слика на целиот тим */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: "40px",
                }}
            >
                {/*<img*/}
                {/*    src={teamPhoto}*/}
                {/*    alt="Целосниот тим"*/}
                {/*    style={{*/}
                {/*        width: "auto",           // ширина автоматска*/}
                {/*        maxWidth: "90%",         // максимум 90% од родителот*/}
                {/*        height: "400px",         // фиксна, но не премногу голема*/}
                {/*        borderRadius: "20px",*/}
                {/*        objectFit: "cover",      // за да се задржат пропорциите*/}
                {/*        boxShadow: "0 8px 25px rgba(0,0,0,0.2)",*/}
                {/*        transition: "transform 0.5s ease",*/}
                {/*    }}*/}
                {/*/>*/}
            </div>

            <h1 style={titleStyle}>Нашиот Тим</h1>
            <p style={{ fontSize: "18px", marginBottom: "40px" }}>
                Нашиот тим се состои од професионалци со долгогодишно искуство во индустријата за убавина.
                Секој член е посветен на обезбедување на највисок квалитет на услуги и индивидуален пристап.
            </p>

            {/* Картички за членовите */}
            <div style={{ display: "flex", justifyContent: "center", gap: "30px", flexWrap: "wrap" }}>
                {members.map((member, index) => (
                    <div
                        key={index}
                        style={{
                            ...cardStyleBase,
                            opacity: visible ? 1 : 0,
                            transform: visible ? "translateY(0)" : "translateY(30px)",
                            transitionDelay: `${index * 0.2}s`,
                        }}
                        onMouseEnter={cardHover}
                        onMouseLeave={cardLeave}
                        onClick={() => member.instagram && window.open(member.instagram, "_blank", "noopener,noreferrer")}
                    >
                        {member.img ? (
                            <img
                                src={member.img}
                                alt={member.name}
                                style={{
                                    width: "100%",
                                    height: "180px",
                                    objectFit: "cover",
                                    borderRadius: "12px",
                                    marginBottom: "10px",
                                }}
                            />
                        ) : (
                            <div
                                aria-label={member.name}
                                style={{
                                    width: "100%",
                                    height: "180px",
                                    borderRadius: "12px",
                                    marginBottom: "10px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    background: "linear-gradient(135deg, #ffd6e7, #f3a6c8)",
                                    color: "white",
                                    fontSize: "72px",
                                    fontFamily: "'Poiret One', cursive",
                                }}
                            >
                                {member.name.charAt(0)}
                            </div>
                        )}
                        <h3 style={{ color: "#bf4f87", marginBottom: "5px", fontSize: "24px" }}>{member.name}</h3>
                        <p style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "5px" }}>{member.role}</p>
                        <p style={{ fontSize: "13px", color: "#333" }}>{member.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AboutUs;
