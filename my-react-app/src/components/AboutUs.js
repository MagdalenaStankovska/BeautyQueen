import React, { useEffect, useState } from "react";
import teamPhoto from "./tim.png";
import saraImg from "./sara.jpg";
import martinaImg from "./martina.png";
import marijaImg from "./marija.png";

const AboutUs = () => {
    const titleStyle = {
        fontFamily: "'Poiret One', cursive",
        color: "palevioletred",
        textAlign: "center",
        marginBottom: "20px",
    };

    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setTimeout(() => setVisible(true), 200);
    }, []);

    const cardStyleBase = {
        width: "220px",
        borderRadius: "15px",
        backgroundColor: "#ffe6f0",
        padding: "15px",
        textAlign: "center",
        boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
        transition: "transform 0.3s, box-shadow 0.3s, opacity 0.6s, transform 0.6s",
        cursor: "pointer",
        opacity: 0,
        transform: "translateY(30px)",
    };

    const cardHover = (e) => {
        e.currentTarget.style.transform = "scale(1.05)";
        e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
    };

    const cardLeave = (e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.1)";
    };

    const members = [
        { name: "Сара", role: "Стилист за коса", desc: "Секогаш создава уникатни фризури со страст и креативност.", img: saraImg, instagram: "https://www.instagram.com/smiiilkovskaa?igsh=MW0xM3h5MjcxbmZ2aA==" },
        { name: "Мартина", role: "Мајстор за шминка", desc: "Нежно ги истакнува убавините на секоја Beauty Queen.", img: martinaImg, instagram: "https://www.instagram.com/temelkova222?igsh=ZnJrM2t4NGI1b3B1" },
        { name: "Марија", role: "Сопственик / Координатор", desc: "Го води тимот со посветеност и љубов кон клиентите.", img: marijaImg, instagram: "https://www.instagram.com/stankovskaa?igsh=ejVpMWNzOXlmdW9h" },
    ];

    return (
        <div style={{ padding: "50px 20px", maxWidth: "1000px", margin: "0 auto", textAlign: "center" }}>
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
                        onClick={() => window.open(member.instagram, "_blank")}
                    >
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
                        <h3 style={{ color: "palevioletred", marginBottom: "5px" }}>{member.name}</h3>
                        <p style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "5px" }}>{member.role}</p>
                        <p style={{ fontSize: "13px", color: "#333" }}>{member.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AboutUs;
