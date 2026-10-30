import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { ProfileForm } from "../src/components/profile-form";
import { colors, ErrorText } from "../src/components/ui";
import { api, ProfileInput, Taxonomy } from "../src/lib/api";
import { useSession } from "../src/lib/session";

export default function OnboardingScreen() {
  const { token, me, saveProfile } = useSession();
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me?.profile?.sports.some((sport) => sport.relation === "FOLLOWS")) router.replace("/feed");
  }, [me]);

  useEffect(() => {
    if (!token) return;
    api<Taxonomy>("/v1/taxonomy", { token })
      .then(setTaxonomy)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load sports"));
  }, [token]);

  async function submit(input: ProfileInput) {
    await saveProfile(input);
    router.replace("/feed");
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Set up your profile</Text>
      <Text style={styles.subtitle}>Tell us whether you play, coach, or run an academy. Pictures can be added from your profile.</Text>
      <ErrorText message={error} />
      <ProfileForm token={token} taxonomy={taxonomy} profile={null} submitLabel="Open the feed" onSubmit={submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, padding: 24, gap: 14, paddingTop: 72, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 15 },
});
