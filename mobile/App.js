import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { api, loadToken, saveToken, setUnauthorizedHandler } from "./src/api";
import AuthScreen from "./src/AuthScreen";
import BookScreen from "./src/BookScreen";
import { AdminRequestsScreen, MyAppointmentsScreen, NotificationsScreen, ProfileScreen } from "./src/ListScreens";
import { colors } from "./src/ui";
import { applyConfig } from "../my-react-app/src/salon";

const POLL_MS = 20000; // keep slots and notifications fresh while the app is open

const CLIENT_TABS = [["book", "📅", "Закажи"], ["mine", "💅", "Мои термини"], ["notes", "🔔", "Известувања"], ["profile", "👤", "Профил"]];
const ADMIN_TABS = [["requests", "📋", "Барања"], ["notes", "🔔", "Известувања"], ["profile", "👤", "Профил"]];

export default function App() {
    const [booting, setBooting] = useState(true);
    const [user, setUser] = useState(null);
    const [tab, setTab] = useState("book");
    const [, setConfigVersion] = useState(0);
    const [data, setData] = useState({ availability: [], mine: [], all: [], notifications: [] });
    const [refreshing, setRefreshing] = useState(false);
    const userRef = useRef(null);
    userRef.current = user;

    const logout = useCallback(async () => {
        await saveToken(null);
        setUser(null);
        setData({ availability: [], mine: [], all: [], notifications: [] });
    }, []);

    useEffect(() => {
        setUnauthorizedHandler(logout);
        (async () => {
            // salon hours/services come from the server; built-in defaults are used if it's unreachable
            api.get("/config").then(cfg => { applyConfig(cfg); setConfigVersion(v => v + 1); }).catch(() => {});
            if (await loadToken()) {
                try {
                    const me = await api.get("/me");
                    setUser(me);
                    setTab(me.role === "admin" ? "requests" : "book");
                } catch {
                    await saveToken(null);
                }
            }
            setBooting(false);
        })();
    }, [logout]);

    const refresh = useCallback(async () => {
        const u = userRef.current;
        if (!u) return;
        setRefreshing(true);
        try {
            if (u.role === "admin") {
                const [all, notifications] = await Promise.all([api.get("/appointments"), api.get("/notifications")]);
                setData(d => ({ ...d, all, notifications }));
            } else {
                const [availability, mine, notifications] = await Promise.all([
                    api.get("/appointments/availability"),
                    api.get("/appointments/user"),
                    api.get("/notifications")
                ]);
                setData(d => ({ ...d, availability, mine, notifications }));
            }
        } catch {
            // offline: keep showing the last data
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!user) return undefined;
        refresh();
        const timer = setInterval(refresh, POLL_MS);
        const sub = AppState.addEventListener("change", s => { if (s === "active") refresh(); });
        return () => { clearInterval(timer); sub.remove(); };
    }, [user, refresh]);

    const onLogin = async ({ token, ...profile }) => {
        await saveToken(token);
        setUser(profile);
        setTab(profile.role === "admin" ? "requests" : "book");
    };

    if (booting) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const tabs = user?.role === "admin" ? ADMIN_TABS : CLIENT_TABS;
    const unread = data.notifications.filter(n => !n.isRead).length;
    const common = { refresh, refreshing };

    return (
        <SafeAreaProvider>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
                <StatusBar style="dark" />
                {!user ? (
                    <AuthScreen onLogin={onLogin} />
                ) : (
                    <>
                        <View style={{ flex: 1 }}>
                            {tab === "book" && <BookScreen availability={data.availability} mine={data.mine} {...common} />}
                            {tab === "mine" && <MyAppointmentsScreen mine={data.mine} {...common} />}
                            {tab === "requests" && <AdminRequestsScreen all={data.all} {...common} />}
                            {tab === "notes" && <NotificationsScreen notifications={data.notifications} {...common} />}
                            {tab === "profile" && <ProfileScreen user={user} onLogout={logout} />}
                        </View>
                        <SafeAreaView edges={["bottom"]} style={{ flexDirection: "row", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border }}>
                            {tabs.map(([key, icon, label]) => (
                                <Pressable key={key} onPress={() => setTab(key)} style={{ flex: 1, alignItems: "center", paddingVertical: 8 }}>
                                    <Text style={{ fontSize: 20 }}>{icon}{key === "notes" && unread > 0 ? ` ${unread}` : ""}</Text>
                                    <Text style={{ fontSize: 11, fontWeight: tab === key ? "800" : "500", color: tab === key ? colors.primary : colors.muted }}>{label}</Text>
                                </Pressable>
                            ))}
                        </SafeAreaView>
                    </>
                )}
            </SafeAreaView>
        </SafeAreaProvider>
    );
}
