import React, { useState } from "react";
import Header from "./components/Header";
import Services from "./components/Services";
import LoginRegister from "./components/LoginRegister";
import Calendar from "./components/Calendar";
import Home from "./components/Home"; // homepage

function App() {
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [role, setRole] = useState(localStorage.getItem("role"));
    const [activeSection, setActiveSection] = useState(null); // nothing shown by default

    const handleLogin = (token, user) => {
        setToken(token);
        setRole(user.role);
        localStorage.setItem("token", token);
        localStorage.setItem("role", user.role);
        setActiveSection("home"); // show homepage after login
    };

    const handleLogout = () => {
        setToken(null);
        setRole(null);
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        setActiveSection(null);
    };

    if (!token) {
        return <LoginRegister onLogin={handleLogin} />;
    }

    return (
        <div className="App">
            <Header
                onNavClick={setActiveSection}
                role={role}
                onLogin={handleLogin}
                onLogout={handleLogout}
                token={token}
            />
            <main
                style={{
                    backgroundColor: "#FFF9FA",
                    minHeight: "100vh",
                    padding: "20px",
                }}
            >
                {activeSection === "home" && (
                    <Home role={role} onNavigate={setActiveSection} />
                )}
                {activeSection === "termin" && <Calendar token={token} role={role} />}
                {activeSection === "услуги" && <Services />}
            </main>
        </div>
    );
}

export default App;
