import React, { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { api } from "./api";
import { Button, Card, colors, Input, Message, styles } from "./ui";
import {
    dayHours,
    dayTimes,
    durationOf,
    formatFriendlyDate,
    formatLocalDate,
    freeTimes,
    isHiddenSlot,
    minutesToTime,
    salon,
    serviceGroups,
    slotProblem,
    toMinutes,
    weekdayShort
} from "../../my-react-app/src/salon";

const DAYS_SHOWN = 45;

const addDays = (date, n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
};

// background / text per slot state
const slotLook = (problem, selected) => {
    if (selected) return { bg: colors.primary, fg: "#fff", border: colors.primary };
    if (!problem) return { bg: colors.soft, fg: "#b73870", border: "#f0bcd5" };
    if (problem.code === "fit") return { bg: "#fffafc", fg: "#c9a7b8", border: "#e8c6d7", dashed: true };
    if (["resource", "staff", "mine"].includes(problem.code)) return { bg: "#f6e9ef", fg: "#b596a6", border: "#e9d2de", strike: true };
    return { bg: colors.grey, fg: "#bfb3b9", border: "#e7e1e4", strike: true };
};

export default function BookScreen({ availability, mine, refresh, refreshing }) {
    const [service, setService] = useState("");
    const [date, setDate] = useState(() => {
        let d = new Date();
        for (let i = 0; i < 14 && !dayHours(formatLocalDate(d)); i++) d = addDays(d, 1);
        return formatLocalDate(d);
    });
    const [time, setTime] = useState("");
    const [note, setNote] = useState("");
    const [blocked, setBlocked] = useState(null);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    const days = useMemo(() => Array.from({ length: Math.min(DAYS_SHOWN, salon().maxDaysAhead) }, (_, i) => addDays(new Date(), i)), []);

    const slots = useMemo(
        () => (service
            ? dayTimes(date)
                .map(t => ({ time: t, problem: slotProblem(availability, { date, time: t, service }, { mine }) }))
                .filter(s => !isHiddenSlot(s.problem)) // start times where the service can't finish aren't offered
            : []),
        [availability, mine, date, service]
    );
    const freeCount = slots.filter(s => !s.problem).length;

    // a slot taken by someone else in the meantime is deselected
    useEffect(() => {
        if (time && !slots.some(s => s.time === time && !s.problem)) setTime("");
    }, [slots, time]);

    const pick = (fn) => { fn(); setTime(""); setBlocked(null); setMessage(null); };

    const submit = async () => {
        setLoading(true);
        setMessage(null);
        try {
            await api.post("/appointments", { date, time, service, note });
            setMessage({ type: "success", text: `Барањето е испратено за ${formatFriendlyDate(date)} во ${time}. Ќе добиете известување кога салонот ќе го потврди.` });
            setTime("");
            setNote("");
        } catch (err) {
            setMessage({ type: "error", text: err.message });
        } finally {
            setLoading(false);
            refresh();
        }
    };

    const hours = dayHours(date);

    return (
        <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
            keyboardShouldPersistTaps="handled"
        >
            <Text style={styles.h1}>Закажи термин</Text>
            <Text style={[styles.muted, { marginBottom: 14 }]}>Изберете услуга, ден и време. Терминот е потврден кога салонот ќе го прифати.</Text>

            <Card>
                <Text style={styles.h2}>1 · Услуга</Text>
                {Object.entries(serviceGroups()).map(([category, names]) => (
                    <View key={category} style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#a0718a", marginBottom: 6, textTransform: "uppercase" }}>{category}</Text>
                        {names.map(n => (
                            <Pressable
                                key={n}
                                onPress={() => pick(() => setService(n))}
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    padding: 12,
                                    borderRadius: 12,
                                    borderWidth: 1.5,
                                    marginBottom: 6,
                                    borderColor: service === n ? colors.primary : colors.border,
                                    backgroundColor: service === n ? colors.soft : "#fffafc"
                                }}
                            >
                                <Text style={{ fontWeight: "600", color: colors.text, flex: 1 }}>{n}</Text>
                                <Text style={styles.muted}>{durationOf(n)} мин</Text>
                            </Pressable>
                        ))}
                    </View>
                ))}
            </Card>

            <Card>
                <Text style={styles.h2}>2 · Ден</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {days.map(d => {
                        const dStr = formatLocalDate(d);
                        const closed = !dayHours(dStr);
                        const full = !closed && service && freeTimes(availability, dStr, service, mine).length === 0;
                        const selected = dStr === date;
                        return (
                            <Pressable
                                key={dStr}
                                disabled={closed}
                                onPress={() => pick(() => setDate(dStr))}
                                style={{
                                    width: 58,
                                    paddingVertical: 10,
                                    marginRight: 8,
                                    borderRadius: 14,
                                    alignItems: "center",
                                    backgroundColor: selected ? colors.primary : closed ? colors.grey : "#fff9fc",
                                    borderWidth: 1,
                                    borderColor: selected ? colors.primary : colors.border,
                                    opacity: closed ? 0.5 : 1
                                }}
                            >
                                <Text style={{ fontSize: 12, color: selected ? "#fff" : colors.muted }}>{weekdayShort[d.getDay()]}</Text>
                                <Text style={{ fontSize: 20, fontWeight: "800", color: selected ? "#fff" : colors.text, textDecorationLine: full ? "line-through" : "none" }}>
                                    {d.getDate()}
                                </Text>
                                <Text style={{ fontSize: 10, color: selected ? "#fff" : colors.muted }}>{full ? "полно" : closed ? "затв." : `${d.getMonth() + 1}`.padStart(2, "0")}</Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </Card>

            <Card>
                <Text style={styles.h2}>3 · Време · {formatFriendlyDate(date)}</Text>
                {hours && <Text style={[styles.muted, { marginTop: -6, marginBottom: 8 }]}>Работно време {hours.open}–{hours.close}</Text>}
                {!service ? (
                    <Text style={styles.muted}>Прво изберете услуга.</Text>
                ) : (
                    <>
                        <Text style={[styles.muted, { marginBottom: 10 }]}>
                            Услугата трае {durationOf(service)} мин. Прикажани се само почетоци каде услугата стигнува да заврши.
                        </Text>
                        {freeCount === 0 && <Text style={[styles.message, styles.msgError, { marginTop: 0, marginBottom: 10 }]}>Нема слободни термини овој ден.</Text>}
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            {slots.map(({ time: t, problem }) => {
                                const look = slotLook(problem, time === t);
                                return (
                                    <Pressable
                                        key={t}
                                        accessibilityLabel={problem ? `${t} недостапно: ${problem.message}` : `${t} слободно`}
                                        onPress={() => (problem ? setBlocked({ time: t, message: problem.message }) : (setBlocked(null), setTime(t)))}
                                        style={{
                                            width: "22.5%",
                                            paddingVertical: 10,
                                            borderRadius: 10,
                                            alignItems: "center",
                                            backgroundColor: look.bg,
                                            borderWidth: 1,
                                            borderStyle: look.dashed ? "dashed" : "solid",
                                            borderColor: blocked?.time === t ? "#d9a3bf" : look.border
                                        }}
                                    >
                                        <Text style={{ fontWeight: "700", color: look.fg, textDecorationLine: look.strike ? "line-through" : "none" }}>{t}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                        {blocked && (
                            <Text style={[styles.message, { backgroundColor: colors.warnBg, color: colors.warn }]}>
                                {blocked.time} не е достапно: {blocked.message}.
                            </Text>
                        )}
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
                            {[["Слободно", slotLook(null)], ["Зафатено", slotLook({ code: "resource" })]].map(([label, l]) => (
                                <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                    <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: l.bg, borderWidth: 1, borderColor: l.border, borderStyle: l.dashed ? "dashed" : "solid" }} />
                                    <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}
            </Card>

            <Card>
                <Text style={styles.h2}>4 · Забелешка (опционално)</Text>
                <Input value={note} onChangeText={setNote} placeholder="На пр. боја, дизајн…" maxLength={300} multiline style={{ minHeight: 60 }} />
                {service && time ? (
                    <View style={{ backgroundColor: colors.soft, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderStyle: "dashed", borderColor: "#e9a5c6" }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#a0718a" }}>ВАШИОТ ТЕРМИН</Text>
                        <Text style={{ fontWeight: "700", color: colors.primaryDark }}>{service}</Text>
                        <Text style={{ color: colors.primaryDark }}>{formatFriendlyDate(date)} · {time} – {minutesToTime(toMinutes(time) + durationOf(service))}</Text>
                    </View>
                ) : null}
                <Button title="Испрати барање" onPress={submit} loading={loading} disabled={!service || !time} />
                <Message message={message} />
            </Card>
        </ScrollView>
    );
}
