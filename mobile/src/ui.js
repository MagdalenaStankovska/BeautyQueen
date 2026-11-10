import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export const colors = {
    bg: "#fff6fa",
    card: "#ffffff",
    primary: "#c94c8a",
    primaryDark: "#9a2f66",
    text: "#3d2433",
    muted: "#8a6577",
    border: "#f0d0df",
    soft: "#fff0f6",
    success: "#1d7a4f",
    successBg: "#d5f5e6",
    danger: "#b03636",
    dangerBg: "#ffe0e0",
    warnBg: "#fff4e5",
    warn: "#7a4d00",
    grey: "#f4f1f3"
};

export const Button = ({ title, onPress, variant = "primary", disabled, loading, style }) => (
    <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
            styles.btn,
            variant === "primary" && styles.btnPrimary,
            variant === "ghost" && styles.btnGhost,
            variant === "danger" && styles.btnDanger,
            variant === "success" && styles.btnSuccess,
            (disabled || loading) && { opacity: 0.5 },
            pressed && { opacity: 0.8 },
            style
        ]}
    >
        {loading ? (
            <ActivityIndicator color={variant === "ghost" ? colors.primary : "#fff"} />
        ) : (
            <Text style={[styles.btnText, variant === "ghost" && { color: colors.primary }]}>{title}</Text>
        )}
    </Pressable>
);

export const Input = (props) => (
    <TextInput placeholderTextColor="#b79aa9" {...props} style={[styles.input, props.style]} />
);

export const Card = ({ children, style }) => <View style={[styles.card, style]}>{children}</View>;

export const Message = ({ message }) =>
    message ? (
        <Text style={[styles.message, message.type === "error" ? styles.msgError : styles.msgOk]}>{message.text}</Text>
    ) : null;

export const statusStyle = {
    pending: { label: "Во чекање", bg: "#fff1c7", fg: "#8a6200" },
    accepted: { label: "Потврден", bg: colors.successBg, fg: colors.success },
    rejected: { label: "Одбиен", bg: colors.dangerBg, fg: colors.danger },
    cancelled: { label: "Откажан", bg: "#eee4ea", fg: "#7a5a6b" }
};

export const StatusChip = ({ status }) => {
    const s = statusStyle[status] || { label: status, bg: colors.grey, fg: colors.muted };
    return <Text style={[styles.chip, { backgroundColor: s.bg, color: s.fg }]}>{s.label}</Text>;
};

export const styles = StyleSheet.create({
    btn: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    btnPrimary: { backgroundColor: colors.primary },
    btnGhost: { backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border },
    btnDanger: { backgroundColor: colors.danger },
    btnSuccess: { backgroundColor: colors.success },
    btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    input: {
        borderWidth: 1,
        borderColor: "#e8bfd6",
        backgroundColor: "#fff9fc",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: colors.text,
        marginBottom: 12
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        shadowColor: "#8c2c5f",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2
    },
    h1: { fontSize: 24, fontWeight: "800", color: colors.primaryDark, marginBottom: 6 },
    h2: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 10 },
    muted: { color: colors.muted, fontSize: 14 },
    message: { marginTop: 12, padding: 12, borderRadius: 10, fontSize: 14, overflow: "hidden" },
    msgError: { backgroundColor: colors.dangerBg, color: colors.danger },
    msgOk: { backgroundColor: colors.successBg, color: colors.success },
    chip: { fontSize: 12, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: "hidden" }
});
