import React, { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { api, API_URL } from "./api";
import { Button, colors, Input, Message, styles } from "./ui";
import { salon } from "../../my-react-app/src/salon";

const TITLES = {
    login: "Најава",
    register: "Регистрација",
    verify: "Потврдете ја сметката",
    forgot: "Заборавена лозинка",
    reset: "Нова лозинка"
};

const SUBMIT = {
    login: "Најави се",
    register: "Регистрирај се",
    verify: "Потврди",
    forgot: "Испрати код",
    reset: "Зачувај нова лозинка"
};

const Link = ({ title, onPress, disabled }) => (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8}>
        <Text style={{ color: disabled ? "#b9a0ad" : colors.primary, fontWeight: "700", textAlign: "center", marginTop: 14 }}>{title}</Text>
    </Pressable>
);

export default function AuthScreen({ onLogin }) {
    const [screen, setScreen] = useState("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [channel, setChannel] = useState("email");
    const [code, setCode] = useState("");
    const [sent, setSent] = useState(null);
    const [cooldown, setCooldown] = useState(0);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const channels = salon().verification || { email: true, sms: false };
    const activeChannel = channels[channel] ? channel : channels.email ? "email" : "sms";
    const isCode = screen === "verify" || screen === "reset";

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const go = (next) => {
        setScreen(next);
        setMessage(null);
        setCode("");
    };

    const run = async (fn) => {
        setLoading(true);
        setMessage(null);
        try {
            await fn();
        } catch (err) {
            if (err.data?.retryAfter) setCooldown(err.data.retryAfter);
            setMessage({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const codeSent = (data, next) => {
        setSent(data);
        setCooldown(data.resendAfter || 60);
        go(next);
    };

    const submit = () => run(async () => {
        if (screen === "login") onLogin(await api.post("/login", { email, password }));
        else if (screen === "register") codeSent(await api.post("/register", { email, password, name, phone, channel: activeChannel }), "verify");
        else if (screen === "verify") onLogin(await api.post("/register/verify", { email, code }));
        else if (screen === "forgot") codeSent(await api.post("/password/forgot", { email, channel: activeChannel }), "reset");
        else onLogin(await api.post("/password/reset", { email, code, newPassword: password }));
    });

    const resend = () => run(async () => {
        const data = screen === "verify"
            ? await api.post("/register/resend", { email })
            : await api.post("/password/forgot", { email, channel: activeChannel });
        setSent(data);
        setCooldown(data.resendAfter || 60);
        setMessage({ type: "success", text: "Испратен е нов код." });
    });

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 40 }} keyboardShouldPersistTaps="handled">
                <Image source={require("../assets/logo.png")} style={{ width: 110, height: 110, alignSelf: "center" }} resizeMode="contain" />
                <Text style={[styles.h1, { textAlign: "center", marginVertical: 12 }]}>{TITLES[screen]}</Text>

                <View style={styles.card}>
                    {isCode && sent && (
                        <Text style={[styles.muted, { marginBottom: 12 }]}>
                            Испративме 6-цифрен код {sent.channel === "sms" ? "во SMS на" : "на"}{" "}
                            <Text style={{ fontWeight: "700", color: colors.text }}>{sent.destination}</Text>.
                            {sent.channel === "email" ? " Проверете го и Spam фолдерот." : ""}
                        </Text>
                    )}
                    {isCode && sent?.devCode && (
                        <Text style={[styles.message, { backgroundColor: colors.warnBg, color: colors.warn, marginTop: 0, marginBottom: 12 }]}>
                            Развоен режим (нема SMTP): кодот е {sent.devCode}
                        </Text>
                    )}

                    {screen === "register" && (
                        <>
                            <Input placeholder="Име и презиме" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
                            <Input placeholder="Телефон (пр. 070 123 456)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
                        </>
                    )}

                    {!isCode && (
                        <Input
                            placeholder="Е-пошта"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="email"
                            textContentType="emailAddress"
                        />
                    )}

                    {isCode && (
                        <Input
                            placeholder="••••••"
                            value={code}
                            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                            keyboardType="number-pad"
                            autoComplete="one-time-code"
                            textContentType="oneTimeCode"
                            maxLength={6}
                            autoFocus
                            style={{ textAlign: "center", fontSize: 28, letterSpacing: 10, fontWeight: "700" }}
                        />
                    )}

                    {(screen === "login" || screen === "register" || screen === "reset") && (
                        <View>
                            <Input
                                placeholder={screen === "login" ? "Лозинка" : "Лозинка (мин. 6 карактери)"}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                textContentType={screen === "login" ? "password" : "newPassword"}
                                style={{ paddingRight: 70 }}
                            />
                            <Pressable onPress={() => setShowPassword(s => !s)} style={{ position: "absolute", right: 14, top: 14 }} hitSlop={8}>
                                <Text style={{ color: colors.primary, fontWeight: "600" }}>{showPassword ? "Сокриј" : "Прикажи"}</Text>
                            </Pressable>
                        </View>
                    )}

                    {(screen === "register" || screen === "forgot") && channels.email && channels.sms && (
                        <View style={{ marginBottom: 12 }}>
                            <Text style={[styles.muted, { marginBottom: 6 }]}>Потврда преку</Text>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                                {[["email", "✉️ Е-пошта"], ["sms", "📱 SMS"]].map(([value, label]) => (
                                    <Pressable
                                        key={value}
                                        onPress={() => setChannel(value)}
                                        style={{
                                            flex: 1,
                                            padding: 12,
                                            borderRadius: 12,
                                            borderWidth: 1.5,
                                            borderColor: channel === value ? colors.primary : colors.border,
                                            backgroundColor: channel === value ? colors.soft : "#fff9fc"
                                        }}
                                    >
                                        <Text style={{ textAlign: "center", fontWeight: channel === value ? "700" : "400", color: colors.text }}>{label}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    )}

                    <Button title={SUBMIT[screen]} onPress={submit} loading={loading} />
                    <Message message={message} />

                    {isCode && (
                        <Link
                            title={cooldown > 0 ? `Испрати нов код за ${cooldown}s` : "Не добивте код? Испрати повторно"}
                            onPress={resend}
                            disabled={cooldown > 0 || loading}
                        />
                    )}
                    {screen === "login" && <Link title="Заборавена лозинка?" onPress={() => go("forgot")} />}
                    <Link
                        title={{
                            login: "Немате сметка? Регистрирај се",
                            register: "Веќе имате сметка? Најави се",
                            verify: "Назад (промени податоци)",
                            forgot: "Назад кон најава",
                            reset: "Назад кон најава"
                        }[screen]}
                        onPress={() => go(screen === "login" || screen === "verify" ? "register" : "login")}
                    />
                </View>

                <Text style={[styles.muted, { textAlign: "center", fontSize: 11 }]}>Сервер: {API_URL}</Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
