import type { AuthSessionResult } from "expo-auth-session";
import * as Facebook from "expo-auth-session/providers/facebook";
import * as Google from "expo-auth-session/providers/google";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { profileRequired } from "../lib/api";
import { useSession } from "../lib/session";
import { Button, colors, ErrorText, Field } from "./ui";

const redirectUriOptions = { path: "login" };

type Pending =
  | { provider: "phone"; phone: string; code: string }
  | { provider: "google"; idToken: string }
  | { provider: "facebook"; accessToken: string };

export function OtherSignIn() {
  const { startPhone, verifyPhone, signInWithGoogle, signInWithFacebook } = useSession();
  const [step, setStep] = useState<"choose" | "phone" | "code" | "profile">("choose");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      const required = profileRequired(err);
      if (required) {
        if (required.suggestedDisplayName) {
          setDisplayName((current) => current || required.suggestedDisplayName || "");
        }
        setStep("profile");
        return;
      }
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  async function finish(next: Pending, profile?: { displayName: string; dateOfBirth: string }) {
    const fields = profile
      ? { displayName: profile.displayName.trim(), dateOfBirth: profile.dateOfBirth.trim() }
      : {};
    if (next.provider === "phone") {
      await verifyPhone({ phone: next.phone, code: next.code, ...fields });
    } else if (next.provider === "google") {
      await signInWithGoogle({ idToken: next.idToken, ...fields });
    } else {
      await signInWithFacebook({ accessToken: next.accessToken, ...fields });
    }
    router.replace("/");
  }

  const googleId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  const facebookId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? "";

  return (
    <View style={styles.block}>
      <Text style={styles.or}>or</Text>
      {googleId ? (
        <GoogleContinue
          clientId={googleId}
          disabled={busy}
          run={run}
          onToken={async (idToken) => {
            const next: Pending = { provider: "google", idToken };
            setPending(next);
            await finish(next);
          }}
        />
      ) : (
        <ContinueButton
          label="Continue with Google"
          disabled={busy}
          onPress={() => setError("Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID.")}
        />
      )}
      {facebookId ? (
        <FacebookContinue
          clientId={facebookId}
          disabled={busy}
          run={run}
          onToken={async (accessToken) => {
            const next: Pending = { provider: "facebook", accessToken };
            setPending(next);
            await finish(next);
          }}
        />
      ) : (
        <ContinueButton
          label="Continue with Facebook"
          disabled={busy}
          onPress={() => setError("Facebook sign-in is not configured. Set EXPO_PUBLIC_FACEBOOK_APP_ID.")}
        />
      )}
      {step === "choose" ? (
        <ContinueButton label="Continue with phone" disabled={busy} onPress={() => { setError(null); setStep("phone"); }} />
      ) : null}
      {step === "phone" ? (
        <>
          <Field
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="10-digit mobile or +E.164"
            keyboardType="phone-pad"
          />
          <Button
            label={busy ? "Sending" : "Send code"}
            disabled={busy || phone.trim().length < 8}
            onPress={() =>
              void run(async () => {
                await startPhone(phone.trim());
                setStep("code");
              })
            }
          />
        </>
      ) : null}
      {step === "code" ? (
        <>
          <Field label="Code" value={code} onChangeText={setCode} placeholder="6-digit code" keyboardType="number-pad" />
          <Button
            label={busy ? "Checking" : "Verify code"}
            disabled={busy || code.trim().length !== 6}
            onPress={() => {
              const next: Pending = { provider: "phone", phone: phone.trim(), code: code.trim() };
              setPending(next);
              void run(() => finish(next));
            }}
          />
        </>
      ) : null}
      {step === "profile" && pending ? (
        <>
          <Text style={styles.note}>Add your name and date of birth. You need to be 13 or older. Use YYYY-MM-DD.</Text>
          <Field label="Name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
          <Field label="Date of birth" value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="2000-01-15" />
          <Button
            label={busy ? "Creating" : "Create account"}
            disabled={busy || displayName.trim().length < 2 || dateOfBirth.trim().length < 8}
            onPress={() => void run(() => finish(pending, { displayName, dateOfBirth }))}
          />
        </>
      ) : null}
      {step !== "choose" ? (
        <Pressable
          disabled={busy}
          onPress={() => {
            setStep("choose");
            setPending(null);
            setError(null);
          }}
        >
          <Text style={styles.back}>Use another method</Text>
        </Pressable>
      ) : null}
      <ErrorText message={error} />
    </View>
  );
}

function GoogleContinue({
  clientId,
  disabled,
  run,
  onToken,
}: {
  clientId: string;
  disabled: boolean;
  run: (task: () => Promise<void>) => Promise<void>;
  onToken: (idToken: string) => Promise<void>;
}) {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest(
    { clientId, webClientId: clientId, iosClientId: clientId, androidClientId: clientId },
    redirectUriOptions,
  );
  return (
    <ContinueButton
      label="Continue with Google"
      disabled={disabled || !request}
      onPress={() =>
        void run(async () => {
          const result = await promptAsync();
          if (result.type === "cancel" || result.type === "dismiss") return;
          if (result.type !== "success") throw new Error(providerFailure(result, "Google sign-in did not finish"));
          const idToken = result.params.id_token || result.authentication?.idToken;
          if (!idToken) throw new Error("Google did not return a sign-in token");
          await onToken(idToken);
        })
      }
    />
  );
}

function FacebookContinue({
  clientId,
  disabled,
  run,
  onToken,
}: {
  clientId: string;
  disabled: boolean;
  run: (task: () => Promise<void>) => Promise<void>;
  onToken: (accessToken: string) => Promise<void>;
}) {
  const [request, , promptAsync] = Facebook.useAuthRequest(
    { clientId, webClientId: clientId, iosClientId: clientId, androidClientId: clientId },
    redirectUriOptions,
  );
  return (
    <ContinueButton
      label="Continue with Facebook"
      disabled={disabled || !request}
      onPress={() =>
        void run(async () => {
          const result = await promptAsync();
          if (result.type === "cancel" || result.type === "dismiss") return;
          if (result.type !== "success") throw new Error(providerFailure(result, "Facebook sign-in did not finish"));
          const accessToken = result.params.access_token || result.authentication?.accessToken;
          if (!accessToken) throw new Error("Facebook did not return a sign-in token");
          await onToken(accessToken);
        })
      }
    />
  );
}

function providerFailure(result: AuthSessionResult, fallback: string): string {
  if (result.type !== "error") return fallback;
  return result.error?.message || result.params.error_description || result.params.error || fallback;
}

function ContinueButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.alt, disabled && styles.disabled]}>
      <Text style={styles.altText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: 14 },
  or: { color: colors.muted, textAlign: "center", fontSize: 13 },
  note: { color: colors.muted, fontSize: 14 },
  back: { color: colors.accent, textAlign: "center", fontSize: 15 },
  alt: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  disabled: { opacity: 0.5 },
  altText: { color: colors.text, fontWeight: "700", fontSize: 16 },
});
