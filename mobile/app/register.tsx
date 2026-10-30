import { Link, router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { OtherSignIn } from "../src/components/other-sign-in";
import { Button, colors, ErrorText, Field, ScreenTitle } from "../src/components/ui";
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
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <ScreenTitle kicker="JOIN THE GAME" title="Create account" subtitle="You need to be 13 or older. Date of birth uses YYYY-MM-DD." />
      <Field label="Name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
      <Field label="Email" value={email} onChangeText={setEmail} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Field label="Date of birth" value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="2000-01-15" />
      <ErrorText message={error} />
      <Button label={busy ? "Creating" : "Continue"} onPress={submit} disabled={busy} />
      <OtherSignIn />
      <Link href="/login" style={styles.link}>
        I already have an account
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 72, justifyContent: "center", gap: 16 },
  link: { color: colors.accent, textAlign: "center", fontSize: 15, fontWeight: "700" },
});
