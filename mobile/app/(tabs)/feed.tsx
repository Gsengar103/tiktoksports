import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, FeedVideo, PublicVideo } from "../../src/lib/api";
import { colors } from "../../src/components/ui";
import { useSession } from "../../src/lib/session";

export default function FeedScreen() {
  const { token } = useSession();
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pageHeight, setPageHeight] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api<{ videos: FeedVideo[] }>("/v1/feed", { token });
      setVideos(response.videos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the feed");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{error}</Text>
      </View>
    );
  }
  if (videos.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No live videos in your sports yet. Upload the first one.</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.fill}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.height);
        if (next > 0 && next !== pageHeight) setPageHeight(next);
      }}
    >
      {pageHeight > 0 ? (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
          onMomentumScrollEnd={(event) => {
            const next = Math.round(event.nativeEvent.contentOffset.y / pageHeight);
            setActive(next);
          }}
          renderItem={({ item, index }) => (
            <FeedPage item={item} active={index === active} height={pageHeight} token={token} />
          )}
          style={styles.fill}
        />
      ) : null}
    </View>
  );
}

function FeedPage({
  item,
  active,
  height,
  token,
}: {
  item: FeedVideo;
  active: boolean;
  height: number;
  token: string | null;
}) {
  const [playback, setPlayback] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(item.counts?.likes ?? 0);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !token) return;
    let cancelled = false;
    api<PublicVideo>(`/v1/public/videos/${item.id}`)
      .then((video) => {
        const file = video.assets.find((asset) => asset.role === "PROGRESSIVE" || asset.role === "PREVIEW");
        if (!cancelled) setPlayback(file?.url ?? null);
      })
      .catch(() => {
        if (!cancelled) setPlayback(null);
      });
    return () => {
      cancelled = true;
    };
  }, [active, item.id, token]);

  async function like() {
    if (!token) return;
    try {
      const result = await api<{ liked: boolean }>(`/v1/videos/${item.id}/likes`, { token });
      setLiked(result.liked);
      setLikes((count) => count + (result.liked ? 1 : -1));
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not like this video");
    }
  }

  async function comment() {
    const body = draft.trim();
    if (!token || !body) return;
    try {
      await api(`/v1/videos/${item.id}/comments`, { token, body: { body } });
      setDraft("");
      setNote("Comment sent");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not send the comment");
    }
  }

  return (
    <View style={[styles.page, { height }]}>
      {active && playback ? <Player url={playback} /> : <View style={styles.poster} />}
      <View style={styles.meta}>
        <Text style={styles.creator}>{item.creator.displayName}</Text>
        <Text style={styles.caption}>{item.caption}</Text>
        <Text style={styles.tags}>
          {item.sportId.replace("sport.", "")} · {item.levelId.replace("level.", "")}
        </Text>
        <View style={styles.commentRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Comment"
            placeholderTextColor={colors.muted}
            style={styles.commentInput}
          />
          <Pressable onPress={() => void comment()}>
            <Text style={styles.send}>Send</Text>
          </Pressable>
        </View>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <Pressable onPress={() => void like()} style={styles.like}>
        <Text style={styles.likeText}>{liked ? "Liked" : "Like"}</Text>
        <Text style={styles.likeCount}>{likes}</Text>
      </Pressable>
    </View>
  );
}

function Player({ url }: { url: string }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = true;
    instance.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  page: { backgroundColor: "#000" },
  poster: { ...StyleSheet.absoluteFill, backgroundColor: "#161616" },
  empty: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { color: colors.muted, fontSize: 16, textAlign: "center" },
  meta: { position: "absolute", left: 16, right: 88, bottom: 24, gap: 6 },
  creator: { color: colors.text, fontWeight: "700", fontSize: 16 },
  caption: { color: colors.text, fontSize: 15 },
  tags: { color: colors.muted, fontSize: 13 },
  commentRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  commentInput: {
    flex: 1,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  send: { color: colors.accent, fontWeight: "700" },
  note: { color: colors.muted, fontSize: 12 },
  like: { position: "absolute", right: 16, bottom: 36, alignItems: "center", gap: 4 },
  likeText: { color: colors.accent, fontWeight: "700" },
  likeCount: { color: colors.text, fontSize: 12 },
});
