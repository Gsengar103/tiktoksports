import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, colors, ErrorText, Field } from "../../src/components/ui";
import { api, Taxonomy } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";

type Result = {
  id: string;
  caption: string;
  sportId: string;
  contentTypeId: string;
  levelId: string;
};

export default function SearchScreen() {
  const { token } = useSession();
  const [query, setQuery] = useState("");
  const [sportId, setSportId] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [videos, setVideos] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<Taxonomy>("/v1/taxonomy", { token }).then(setTaxonomy).catch(() => undefined);
  }, [token]);

  async function search() {
    if (!token) return;
    setError(null);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (sportId) params.set("sportId", sportId);
    try {
      const response = await api<{ videos: Result[] }>(`/v1/search?${params.toString()}`, { token });
      setVideos(response.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Search</Text>
      <Field label="Keyword" value={query} onChangeText={setQuery} placeholder="footwork, drill, match" />
      <View style={styles.wrap}>
        <Chip label="All sports" active={sportId === null} onPress={() => setSportId(null)} />
        {taxonomy?.sports.map((sport) => (
          <Chip key={sport.id} label={sport.name} active={sport.id === sportId} onPress={() => setSportId(sport.id)} />
        ))}
      </View>
      <Button label="Search" onPress={search} />
      <ErrorText message={error} />
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Live videos that match will show here.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.caption}>{item.caption}</Text>
            <Text style={styles.meta}>{item.sportId}</Text>
          </View>
        )}
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 64, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text },
  chipTextOn: { color: "#111", fontWeight: "700" },
  empty: { color: colors.muted, marginTop: 12 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 4 },
  caption: { color: colors.text, fontSize: 16 },
  meta: { color: colors.muted, fontSize: 13 },
});
