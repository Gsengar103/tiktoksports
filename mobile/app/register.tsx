import { Link, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, colors, ErrorText, Field } from "../src/components/ui";
import { useSession } from "../src/lib/session";

export default function RegisterScreen() {
  const { register } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        dateOfBirth,
      });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>You need to be 13 or older. Use YYYY-MM-DD for the date of birth.</Text>
      <Field label="Name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
      <Field label="Email" value={email} onChangeText={setEmail} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Field label="Date of birth" value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="2000-01-15" />
      <ErrorText message={error} />
      <Button label={busy ? "Creating" : "Continue"} onPress={submit} disabled={busy} />
      <Link href="/login" style={styles.link}>
        I already have an account
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center", gap: 14 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 15 },
  link: { color: colors.accent, textAlign: "center", fontSize: 15 },
});
