import { Link, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, colors, ErrorText, Field } from "../src/components/ui";
import { useSession } from "../src/lib/session";

export default function LoginScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Sports</Text>
      <Text style={styles.subtitle}>Short videos for the sport you actually play.</Text>
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <ErrorText message={error} />
      <Button label={busy ? "Signing in" : "Sign in"} onPress={submit} disabled={busy} />
      <Link href="/register" style={styles.link}>
        Create an account
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center", gap: 14 },
  title: { color: colors.text, fontSize: 32, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 16, marginBottom: 8 },
  link: { color: colors.accent, textAlign: "center", fontSize: 15 },
});
