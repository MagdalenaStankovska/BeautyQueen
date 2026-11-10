import React, { useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { api } from "./api";
import { Button, Card, colors, Input, StatusChip, styles } from "./ui";
import { appointmentDate, employeeLabel, endTimeOf, formatFriendlyDate, isActive, timeAgo } from "../../my-react-app/src/salon";

const Screen = ({ title, refreshing, refresh, children }) => (
    <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
    >
        <Text style={[styles.h1, { marginBottom: 14 }]}>{title}</Text>
        {children}
    </ScrollView>
);

const Empty = ({ text }) => <Text style={[styles.muted, { textAlign: "center", marginTop: 30 }]}>{text}</Text>;

/* ---------- client: my appointments ---------- */

export function MyAppointmentsScreen({ mine, refresh, refreshing }) {
    const now = new Date();
    const upcoming = mine.filter(a => isActive(a) && appointmentDate(a) > now).sort((a, b) => appointmentDate(a) - appointmentDate(b));
    const history = mine.filter(a => !upcoming.includes(a)).sort((a, b) => appointmentDate(b) - appointmentDate(a)).slice(0, 30);

    const cancel = (a) => {
        Alert.alert("Откажи термин", `${a.service}\n${formatFriendlyDate(a.date)} во ${a.time}`, [
            { text: "Назад", style: "cancel" },
            {
                text: "Откажи термин",
                style: "destructive",
                onPress: async () => {
                    try {
                        await api.patch(`/appointments/${a.id}/cancel`, { reason: "Откажано од апликација" });
                    } catch (err) {
                        Alert.alert("Грешка", err.message);
                    }
                    refresh();
                }
            }
        ]);
    };

    return (
        <Screen title="Мои термини" refresh={refresh} refreshing={refreshing}>
            {upcoming.length === 0 && <Empty text="Немате претстојни термини." />}
            {upcoming.map(a => (
                <Card key={a.id} style={{ borderLeftWidth: 5, borderLeftColor: a.status === "accepted" ? colors.success : "#e6a100" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontWeight: "800", color: colors.text }}>{formatFriendlyDate(a.date)} · {a.time}–{endTimeOf(a)}</Text>
                        <StatusChip status={a.status} />
                    </View>
                    <Text style={{ marginTop: 6, color: colors.text }}>{a.service}</Text>
                    {a.employee && <Text style={styles.muted}>Вработена: {employeeLabel(a.employee)}</Text>}
                    {a.status === "pending" && <Text style={styles.muted}>Чека потврда од салонот</Text>}
                    <Button title="Откажи" variant="ghost" onPress={() => cancel(a)} style={{ marginTop: 10, paddingVertical: 8 }} />
                </Card>
            ))}

            {history.length > 0 && <Text style={[styles.h2, { marginTop: 10 }]}>Историја</Text>}
            {history.map(a => (
                <Card key={a.id} style={{ opacity: 0.8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontWeight: "700", color: colors.text }}>{formatFriendlyDate(a.date)} · {a.time}</Text>
                        <StatusChip status={a.status} />
                    </View>
                    <Text style={{ color: colors.text }}>{a.service}</Text>
                    {(a.rejectReason || (a.status === "cancelled" && a.cancelReason)) && (
                        <Text style={styles.muted}>Причина: {a.rejectReason || a.cancelReason}</Text>
                    )}
                </Card>
            ))}
        </Screen>
    );
}

/* ---------- notifications ---------- */

export function NotificationsScreen({ notifications, refresh, refreshing }) {
    const markAll = async () => {
        await api.patch("/notifications/read-all").catch(() => {});
        refresh();
    };
    return (
        <Screen title="Известувања" refresh={refresh} refreshing={refreshing}>
            {notifications.some(n => !n.isRead) && <Button title="Означи ги сите како прочитани" variant="ghost" onPress={markAll} style={{ marginBottom: 14 }} />}
            {notifications.length === 0 && <Empty text="Немате известувања." />}
            {notifications.map(n => (
                <Card key={n.id} style={!n.isRead ? { borderLeftWidth: 5, borderLeftColor: colors.primary } : null}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>{n.title}</Text>
                    <Text style={{ color: colors.text, marginTop: 4 }}>{n.message}</Text>
                    <Text style={[styles.muted, { fontSize: 12, marginTop: 6 }]}>{timeAgo(n.createdAt)}</Text>
                </Card>
            ))}
        </Screen>
    );
}

/* ---------- admin: pending requests ---------- */

export function AdminRequestsScreen({ all, refresh, refreshing }) {
    const [busy, setBusy] = useState(null);
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState("");

    const pending = all.filter(a => a.status === "pending").sort((a, b) => appointmentDate(a) - appointmentDate(b));
    const today = new Date().toLocaleDateString("sv-SE");
    const todayList = all.filter(a => a.status === "accepted" && a.date === today).sort((a, b) => a.time.localeCompare(b.time));

    const update = async (a, body) => {
        setBusy(a.id);
        try {
            await api.patch(`/appointments/${a.id}`, body);
        } catch (err) {
            Alert.alert("Грешка", err.message);
        }
        setBusy(null);
        setRejecting(null);
        setReason("");
        refresh();
    };

    return (
        <Screen title="Нови барања" refresh={refresh} refreshing={refreshing}>
            {pending.length === 0 && <Empty text="Нема нови барања." />}
            {pending.map(a => (
                <Card key={a.id}>
                    <Text style={{ fontWeight: "800", color: colors.text }}>{a.clientName || a.userEmail}</Text>
                    <Text style={{ color: colors.text, marginTop: 2 }}>{a.service}</Text>
                    <Text style={styles.muted}>📅 {formatFriendlyDate(a.date)} · {a.time}–{endTimeOf(a)}</Text>
                    {a.clientPhone ? <Text style={styles.muted}>📞 {a.clientPhone}</Text> : null}
                    {a.note ? <Text style={[styles.muted, { fontStyle: "italic" }]}>💬 {a.note}</Text> : null}
                    {rejecting === a.id ? (
                        <View style={{ marginTop: 10 }}>
                            <Input placeholder="Причина (клиентот ќе ја види)" value={reason} onChangeText={setReason} />
                            <View style={{ flexDirection: "row", gap: 8 }}>
                                <Button title="Назад" variant="ghost" onPress={() => setRejecting(null)} style={{ flex: 1 }} />
                                <Button title="Одбиј" variant="danger" loading={busy === a.id} onPress={() => update(a, { status: "rejected", reason })} style={{ flex: 1 }} />
                            </View>
                        </View>
                    ) : (
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                            <Button title="Прифати" variant="success" loading={busy === a.id} onPress={() => update(a, { status: "accepted" })} style={{ flex: 1 }} />
                            <Button title="Одбиј" variant="ghost" onPress={() => setRejecting(a.id)} style={{ flex: 1 }} />
                        </View>
                    )}
                </Card>
            ))}

            <Text style={[styles.h2, { marginTop: 10 }]}>Денес ({todayList.length})</Text>
            {todayList.length === 0 && <Text style={styles.muted}>Нема потврдени термини денес.</Text>}
            {todayList.map(a => (
                <Card key={a.id}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>{a.time}–{endTimeOf(a)} · {a.clientName || a.userEmail}</Text>
                    <Text style={styles.muted}>{a.service}{a.employee ? ` · ${employeeLabel(a.employee)}` : ""}</Text>
                </Card>
            ))}
        </Screen>
    );
}

/* ---------- profile ---------- */

export function ProfileScreen({ user, onLogout }) {
    return (
        <Screen title="Профил" refresh={() => {}} refreshing={false}>
            <Card>
                <Text style={{ fontWeight: "800", fontSize: 18, color: colors.text }}>{user.name || "—"}</Text>
                <Text style={[styles.muted, { marginTop: 4 }]}>{user.email} {user.emailVerified ? "✅" : ""}</Text>
                {user.phone ? <Text style={styles.muted}>{user.phone} {user.phoneVerified ? "✅" : ""}</Text> : null}
                {user.role === "admin" && <Text style={{ color: colors.primary, fontWeight: "700", marginTop: 6 }}>Администратор</Text>}
            </Card>
            <Button title="Одјава" variant="danger" onPress={onLogout} />
        </Screen>
    );
}
