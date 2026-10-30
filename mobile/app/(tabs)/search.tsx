import { useEffect, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { WatchSession } from "../../src/components/watch";
import { Button, Chip, colors, ErrorText, Field, ScreenTitle } from "../../src/components/ui";
import { api, FeedVideo, Taxonomy } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";

export default function SearchScreen() {
  const { token } = useSession();
  const [query, setQuery] = useState("");
  const [sportId, setSportId] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [queue, setQueue] = useState<FeedVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<Taxonomy>("/v1/taxonomy", { token }).then(setTaxonomy).catch(() => undefined);
  }, [token]);

  async function search() {
    if (!token) return;
    setError(null);
    setQueue(null);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (sportId) params.set("sportId", sportId);
    try {
      const response = await api<{ videos: FeedVideo[] }>(`/v1/search?${params.toString()}`, { token });
      setVideos(response.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  }

  async function open(item: FeedVideo) {
    if (!token || opening) return;
    setOpening(item.id);
    setError(null);
    try {
      const related = await api<{ videos: FeedVideo[] }>(`/v1/search/related?videoId=${encodeURIComponent(item.id)}`, { token });
      const rest = related.videos.filter((video) => video.id !== item.id);
      setQueue([item, ...rest]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that video");
    } finally {
      setOpening(null);
    }
  }

  if (queue && queue.length > 0) {
    return <WatchSession videos={queue} token={token} onClose={() => setQueue(null)} />;
  }

  const sportName = (id: string) => taxonomy?.sports.find((sport) => sport.id === id)?.name ?? id.replace("sport.", "");

  return (
    <View style={styles.screen}>
      <ScreenTitle kicker="FIND A CLIP" title="Search" />
      <Field label="Keyword" value={query} onChangeText={setQuery} placeholder="footwork, drill, match" />
      <View style={styles.wrap}>
        <Chip label="All" active={sportId === null} onPress={() => setSportId(null)} />
        {taxonomy?.sports.map((sport) => (
          <Chip key={sport.id} label={sport.name} active={sport.id === sportId} onPress={() => setSportId(sport.id)} />
        ))}
      </View>
      <Button label="Search" onPress={search} />
      <ErrorText message={error} />
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Live videos that match will show here. Tap one to play it.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => void open(item)} style={styles.row} disabled={opening === item.id}>
            <ResultThumb url={item.thumbUrl ?? null} sport={sportName(item.sportId)} />
            <View style={styles.rowBody}>
              <Text style={styles.caption}>{item.caption || "Untitled"}</Text>
              <Text style={styles.meta}>
                {sportName(item.sportId)} · {item.creator.displayName}
              </Text>
            </View>
            <Text style={styles.play}>{opening === item.id ? "Opening" : "Play"}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function ResultThumb({ url, sport }: { url: string | null; sport: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) return <Image source={{ uri: url }} style={styles.thumb} onError={() => setFailed(true)} />;
  const initial = sport.trim().charAt(0).toUpperCase() || "•";
  return (
    <View style={styles.placeholder}>
      <Text style={styles.initial}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 64, paddingBottom: 96, gap: 14 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  list: { flex: 1 },
  empty: { color: colors.muted, marginTop: 12, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 18,
  },
  thumb: { width: 72, height: 96, borderRadius: 14, backgroundColor: "#101010" },
  placeholder: {
    width: 72,
    height: 96,
    borderRadius: 14,
    backgroundColor: "#101010",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: colors.accent, fontSize: 22, fontWeight: "800" },
  rowBody: { flex: 1, gap: 4 },
  caption: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 13 },
  play: { color: colors.ink, backgroundColor: colors.accent, fontWeight: "800", borderRadius: 999, overflow: "hidden", paddingHorizontal: 14, paddingVertical: 8 },
});
