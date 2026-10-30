import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export const colors = {
  bg: "#050505",
  card: "#141414",
  line: "#2a2a2a",
  text: "#f6f6f4",
  muted: "#8e8e8e",
  accent: "#d6ff3e",
  ink: "#111111",
  danger: "#ff5d73",
};

export function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  placeholder,
  autoCapitalize = "none",
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  placeholder?: string;
  autoCapitalize?: "none" | "words" | "sentences";
  keyboardType?: "default" | "phone-pad" | "number-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, disabled && styles.disabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

export function ScreenTitle({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.titleBlock}>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <Text style={styles.screenTitle}>{title}</Text>
      {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "600", letterSpacing: 0.4 },
  input: {
    backgroundColor: "#101010",
    color: colors.text,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  disabled: { opacity: 0.45 },
  buttonText: { color: colors.ink, fontWeight: "800", fontSize: 16, letterSpacing: 0.2 },
  error: { color: colors.danger, fontSize: 14 },
  titleBlock: { gap: 6 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  screenTitle: { color: colors.text, fontSize: 34, fontWeight: "800", letterSpacing: -0.8 },
  screenSubtitle: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#101010",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontWeight: "600" },
  chipTextOn: { color: colors.ink, fontWeight: "800" },
});
