import { Link, router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { OtherSignIn } from "../src/components/other-sign-in";
import { Button, colors, ErrorText, Field, ScreenTitle } from "../src/components/ui";
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
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <ScreenTitle kicker="YOUR SPORT. YOUR CLIP." title="Sports" subtitle="Short videos for the game you actually play." />
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <ErrorText message={error} />
      <Button label={busy ? "Signing in" : "Sign in"} onPress={submit} disabled={busy} />
      <OtherSignIn />
      <Link href="/register" style={styles.link}>
        Create an account
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 72, justifyContent: "center", gap: 16 },
  link: { color: colors.accent, textAlign: "center", fontSize: 15, fontWeight: "700" },
});
