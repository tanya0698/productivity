import React from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Platform } from "react-native";
import Text from "./Text";
import { fonts, radii, usePalette } from "../theme";

/** A labelled form row. */
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text weight="medium" tone="secondary" style={{ fontSize: 13 }}>
        {label}
      </Text>
      {children}
      {hint ? (
        <Text tone="muted" style={{ fontSize: 12 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const p = usePalette();
  return (
    <TextInput
      placeholderTextColor={p.textMuted}
      {...props}
      style={[styles.input, { backgroundColor: p.page, borderColor: p.borderStrong, color: p.text }, props.style]}
    />
  );
}

/** A tappable value that opens Android's own date or time dialog. */
export function DateTimeButton({
  value: given,
  mode,
  onChange,
  label,
  minimumDate,
  placeholder,
  onClear,
  disabled = false,
}: {
  /** Null shows the placeholder; the dialog then starts from now. */
  value: Date | null;
  mode: "date" | "time";
  onChange: (d: Date) => void;
  label: string;
  minimumDate?: Date;
  placeholder?: string;
  /** Shows a clear (×) button while there's a value. */
  onClear?: () => void;
  disabled?: boolean;
}) {
  const p = usePalette();
  const [iosOpen, setIosOpen] = React.useState(false);
  const value = given ?? new Date();
  const text = !given
    ? (placeholder ?? "")
    : mode === "date"
      ? value.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : value.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const picked = (e: DateTimePickerEvent, d?: Date) => {
    setIosOpen(false);
    if (e.type === "set" && d) onChange(d);
  };
  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({ value, mode, onChange: picked, is24Hour: true, minimumDate });
    } else setIosOpen(true);
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}. Tap to change.`}
        onPress={open}
        disabled={disabled}
        style={({ pressed }) => [styles.input, styles.button, { backgroundColor: p.page, borderColor: p.borderStrong, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}
      >
        <Ionicons name={mode === "date" ? "calendar-outline" : "time-outline"} size={16} color={p.textSecondary} />
        <Text style={{ flex: 1 }} tone={given ? "primary" : "muted"}>
          {text}
        </Text>
        {given && onClear && !disabled ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label.toLowerCase()}`} hitSlop={10} onPress={onClear}>
            <Ionicons name="close-circle" size={18} color={p.textMuted} />
          </Pressable>
        ) : null}
      </Pressable>
      {iosOpen ? <DateTimePicker value={value} mode={mode} onChange={picked} minimumDate={minimumDate} /> : null}
    </>
  );
}

/** A row of choice chips; one selected. */
export function Chips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const p = usePalette();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.chip, { borderColor: on ? p.primary : p.borderStrong, backgroundColor: on ? p.primarySoft : "transparent" }]}
          >
            <Text style={{ fontSize: 13, color: on ? p.primaryStrong : p.textSecondary }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Primary, plain and danger buttons. */
export function Button({
  label,
  onPress,
  kind = "plain",
  disabled = false,
  small = false,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "plain" | "danger";
  disabled?: boolean;
  small?: boolean;
}) {
  const p = usePalette();
  const bg = kind === "primary" ? p.primary : "transparent";
  const fg = kind === "primary" ? p.onPrimary : kind === "danger" ? p.errorText : p.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderWidth: kind === "primary" ? 0 : 1,
          borderColor: p.borderStrong,
          borderRadius: radii.sm,
          paddingHorizontal: small ? 12 : 18,
          paddingVertical: small ? 6 : 11,
          alignItems: "center",
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text weight="semiBold" style={{ color: fg, fontSize: small ? 13 : 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: fonts.native.regular },
  button: { flexDirection: "row", alignItems: "center", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
});
