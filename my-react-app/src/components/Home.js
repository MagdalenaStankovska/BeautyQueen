import React from "react";
import vaucher1 from "./1.jpg";
import gintonik from "./gintonik.png";
import kolagen from "./kolagen.png";
import tim from "./tim.png";
import salon1 from "./salon1.png";
import salon2 from "./salon2.png";
import sijalichka from "./sijalichka.png";
import biserche from "./biserche.png";
import biserche1 from "./biseri1.png"
// ако сликата е во истата папка како компонентата
// import vaucher2 from "./2.jpg"; // ако сликата е во истата папка како компонентата


function Home({ role, onNavigate }) {
    const titleStyle = {
        fontFamily: "'Poiret One', cursive",
        color: "palevioletred",
        // marginBottom: "30px",
        // marginTop: "30px",
        textShadow: "none", // отстранета сенка
    };

    const subtitleStyle = {
        fontSize: "1.5rem",
        marginBottom: "20px",
    };

    const buttonStylePrimary = {
        backgroundColor: "palevioletred",
        color: "white",
        padding: "12px 25px",
        fontSize: "18px",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        marginRight: "12px",
        transition: "all 0.3s ease",
    };

    const buttonStyleSecondary = {
        backgroundColor: "white",
        color: "palevioletred",
        padding: "12px 25px",
        fontSize: "18px",
        border: "2px solid palevioletred",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "all 0.3s ease",
    };

    const serviceCardStyle = {
        width: "250px",
        transition: "transform 0.3s, box-shadow 0.3s",
        borderRadius: "12px",
        cursor: "pointer",
    };

    return (
        <div style={{ fontFamily: "'Arial', sans-serif", color: "#333" }}>
            {/* Hero banner */}
            <section style={{ position: "relative" }}>
                <img
                    src={biserche1}
                    alt="Beauty Queen Banner"
                    style={{
                        opacity: "40%",
                        width: "100%",
                        borderRadius: "15px",
                        maxHeight: "500px",
                        objectFit: "cover",
                    }}
                />
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        color: "white",
                        textAlign: "center",
                        width: "90%",
                    }}
                >
                    <h1 style={{ ...titleStyle, fontSize: "3.2rem" }}>
                        Добредојдовте во Beauty Queen!
                    </h1>
                    <p style={subtitleStyle}>
                        Нашата Pinktastic енергија е тука за вашата убавина
                    </p>
                    <div>
                        <button
                            onClick={() => onNavigate("услуги")}
                            style={buttonStylePrimary}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.transform = "scale(1.05)")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.transform = "scale(1)")
                            }
                        >
                            Погледни услуги
                        </button>
                        <button
                            onClick={() => onNavigate("termin")}
                            style={buttonStyleSecondary}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.transform = "scale(1.05)")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.transform = "scale(1)")
                            }
                        >
                            Закажи термин
                        </button>
                    </div>
                </div>
            </section>

            {/* Our Services */}
            <section style={{ padding: "50px 20px", textAlign: "center" }}>
                <h2 style={{ ...titleStyle, fontSize: "2.2rem", marginBottom: "30px" }}>
                    Нашите Услуги
                </h2>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "90px",
                        flexWrap: "wrap",
                    }}
                >
                    {[
                        {
                            img: gintonik,
                            title: "Gin & Tonik Искуство",
                            desc: "Убави моменти и уникатна услуга за секоја наша Beauty Queen.",
                        },
                        {
                            img: vaucher1,
                            title: "Подари Ваучер / Подарок за најблиските!",
                            desc: "Подарете ваучер на најблиските за било која услуга, во било која вредност",
                        },
                        {
                            img: kolagen,
                            title: "НОВО! / Педикир со кристален колаген",
                            desc: "Совршени нокти и нега за вашите нозе со долг траен ефект.",
                        },
                    ].map((service, index) => (
                        <div
                            key={index}
                            style={serviceCardStyle}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "scale(1.05)";
                                e.currentTarget.style.boxShadow =
                                    "0 8px 20px rgba(0,0,0,0.2)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "scale(1)";
                                e.currentTarget.style.boxShadow = "none";
                            }}
                        >
                            <img
                                src={service.img}
                                alt={service.title}
                                style={{
                                    width: "100%",
                                    height: "180px", // фиксна висина за сите
                                    borderRadius: "12px",
                                    objectFit: "cover",
                                }}
                            />
                            <h3 style={titleStyle}>{service.title}</h3>
                            <p>{service.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Our Energy */}
            <section
                style={{
                    backgroundColor: "#FFF0F5",
                    padding: "50px 20px",
                    textAlign: "center",
                }}
            >
                <h2 style={{ ...titleStyle, fontSize: "2.2rem", marginBottom: "30px" }}>
                    Нашата Pinktastic Енергија
                </h2>
                <p
                    style={{
                        maxWidth: "700px",
                        margin: "0 auto",
                        fontSize: "1.2rem",
                        marginBottom: "30px",
                    }}
                >
                    Секој посетител го третираат како кралица. Придружете ни се за пијалак и закажете
                    термин и уживајте во уникатната атмосфера.
                </p>
                <img
                    src={salon1}
                    alt="Our Energy"
                    style={{
                        width: "300px",
                        height: "250px", // фиксна висина за сите
                        borderRadius: "12px",
                        objectFit: "cover",
                    }}
                />
            </section>

            {/* Location / Contact */}
            <section style={{ padding: "50px 20px", textAlign: "center" }}>
                <h2 style={{ ...titleStyle, fontSize: "2.2rem", marginBottom: "20px" }}>
                    Локација
                </h2>
                <p>Се наоѓаме на ул. Антон Панов бр.20, Капиштец. Ве чекаме!</p>
                <iframe
                    title="Beauty Queen Location"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2924.661827777787!2d21.426940!3d41.998126!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x13541e7f2827c71d%3A0xabcdef1234567890!2sAnton%20Panov%2020%2C%20Skopje!5e0!3m2!1sen!2smk!4v1699999999999!5m2!1sen!2smk"
                    width="80%"
                    height="450"
                    style={{ border: 0, borderRadius: "12px" }}
                    allowFullScreen=""
                    loading="lazy"
                ></iframe>
            </section>

            {/* Contact Us */}
            <section style={{padding: "50px 20px", textAlign: "center", backgroundColor: "#fff0f5"}}>
                <h2 style={{...titleStyle, fontSize: "2.2rem", marginBottom: "20px"}}>
                    Контактирајте не
                </h2>
                <p style={{fontSize: "1.2rem", marginBottom: "20px"}}>
                    Телефон: +389 70 283 453<br/>
                    Email: marija.stankovska@yahoo.com<br/>
                    Instagram: Instagram: <a href="https://www.instagram.com/_beautyqueenstudio_/?hl=en" target="_blank"
                                             rel="noopener noreferrer">@beautyqueen</a><br/>
                    Работно време: Пон-Пет 11:00 - 20:00, Саб 10:00 - 16:00
                </p>
                <a
                    href="mailto:marija.stankovska@yahoo.com"
                    style={{
                        ...buttonStylePrimary,
                        display: "inline-block",
                        textDecoration: "none",
                        textAlign: "center",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                    Испрати порака
                </a>
            </section>
        </div>
    );
}

export default Home;
