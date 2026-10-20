import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, colors, ErrorText } from "../src/components/ui";
import { api, Taxonomy } from "../src/lib/api";
import { useSession } from "../src/lib/session";

const GOALS = [
  { id: "WATCH", label: "Watch" },
  { id: "LEARN", label: "Learn" },
  { id: "PLAY_MORE", label: "Play more" },
] as const;

export default function OnboardingScreen() {
  const { token, me, saveProfile } = useSession();
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [sportId, setSportId] = useState<string | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [goal, setGoal] = useState<(typeof GOALS)[number]["id"]>("PLAY_MORE");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me?.profile?.sports.some((sport) => sport.relation === "FOLLOWS")) router.replace("/feed");
  }, [me]);

  useEffect(() => {
    if (!token) return;
    api<Taxonomy>("/v1/taxonomy", { token })
      .then(setTaxonomy)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load sports"));
  }, [token]);

  async function submit() {
    if (!sportId) {
      setError("Pick a sport");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveProfile({
        goal,
        cityVisible: false,
        sports: [{ sportId, relation: "FOLLOWS", levelId: levelId ?? undefined }],
      });
      router.replace("/feed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>What do you follow?</Text>
      <Text style={styles.subtitle}>This builds the first feed. You can follow more sports later.</Text>
      <View style={styles.wrap}>
        {taxonomy?.sports.map((sport) => (
          <Choice key={sport.id} label={sport.name} active={sport.id === sportId} onPress={() => setSportId(sport.id)} />
        ))}
      </View>
      <Text style={styles.heading}>Level</Text>
      <View style={styles.wrap}>
        {taxonomy?.levels.map((level) => (
          <Choice key={level.id} label={level.name} active={level.id === levelId} onPress={() => setLevelId(level.id)} />
        ))}
      </View>
      <Text style={styles.heading}>Goal</Text>
      <View style={styles.wrap}>
        {GOALS.map((item) => (
          <Choice key={item.id} label={item.label} active={item.id === goal} onPress={() => setGoal(item.id)} />
        ))}
      </View>
      <ErrorText message={error} />
      <Button label={busy ? "Saving" : "Open the feed"} onPress={submit} disabled={busy} />
    </ScrollView>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceOn]}>
      <Text style={[styles.choiceText, active && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, padding: 24, gap: 14, paddingTop: 72 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 15 },
  heading: { color: colors.text, fontSize: 16, fontWeight: "600", marginTop: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  choiceOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceText: { color: colors.text },
  choiceTextOn: { color: "#111", fontWeight: "700" },
});
