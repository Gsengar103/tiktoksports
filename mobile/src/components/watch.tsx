import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { Dimensions, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, FeedVideo, PublicVideo } from "../lib/api";
import { colors } from "./ui";

const seenViews = new Set<string>();

export function WatchSession({
  videos,
  token,
  onClose,
}: {
  videos: FeedVideo[];
  token: string | null;
  onClose: () => void;
}) {
  const [active, setActive] = useState(0);
  const [pageHeight, setPageHeight] = useState(Dimensions.get("window").height);

  return (
    <View
      style={styles.fill}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.height);
        if (next > 0 && next !== pageHeight) setPageHeight(next);
      }}
    >
      <FlatList
        data={videos}
        extraData={active}
        keyExtractor={(item) => item.id}
        pagingEnabled
        snapToInterval={pageHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: pageHeight, offset: pageHeight * index, index })}
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.height);
          if (next > 0 && next !== pageHeight) setPageHeight(next);
        }}
        onScroll={(event) => {
          const next = pageIndex(event.nativeEvent.contentOffset.y, pageHeight, videos.length);
          setActive((current) => (current === next ? current : next));
        }}
        onMomentumScrollEnd={(event) => setActive(pageIndex(event.nativeEvent.contentOffset.y, pageHeight, videos.length))}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <WatchPage item={item} active={index === active} height={pageHeight} token={token} more={index < videos.length - 1} />
        )}
        style={styles.fill}
      />
      <Pressable onPress={onClose} style={styles.back}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </View>
  );
}

function WatchPage({
  item,
  active,
  height,
  token,
  more,
}: {
  item: FeedVideo;
  active: boolean;
  height: number;
  token: string | null;
  more: boolean;
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
        const file = playableAsset(video.assets);
        if (!cancelled) setPlayback(file?.url ?? null);
      })
      .catch(() => {
        if (!cancelled) setPlayback(null);
      });
    if (!seenViews.has(item.id)) {
      seenViews.add(item.id);
      void api(`/v1/videos/${item.id}/views`, { token }).catch(() => {
        seenViews.delete(item.id);
      });
    }
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
        <Text style={styles.caption}>{item.caption || "Untitled"}</Text>
        <Text style={styles.tags}>
          {item.sportId.replace("sport.", "")} · {item.levelId.replace("level.", "")}
        </Text>
        <Text style={styles.tags}>{more ? "Swipe up for a similar video" : "That's the last similar video"}</Text>
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

function pageIndex(offset: number, pageHeight: number, count: number) {
  if (pageHeight <= 0 || count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(offset / pageHeight)));
}

function playableAsset(assets: { role: string; url: string }[]) {
  return assets.find((asset) => asset.role === "PROGRESSIVE") ?? assets.find((asset) => asset.role === "PREVIEW");
}

function Player({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const [audible, setAudible] = useState(Platform.OS !== "web");
  const [space, setSpace] = useState({ width: 0, height: 0 });
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = true;
    // Browsers block unmuted playback that starts after the tap has finished loading the file.
    instance.muted = Platform.OS === "web";
  });

  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") setFailed(true);
    if (status === "readyToPlay") setFrame(readFrame(player));
  });
  useEventListener(player, "videoTrackChange", ({ videoTrack }) => {
    const size = videoTrack?.size;
    if (size?.width && size?.height) setFrame({ width: size.width, height: size.height });
  });

  useEffect(() => {
    // play() during setup runs before the video element exists, so the first frame stays frozen.
    player.play();
  }, [player, frame, space.width, space.height]);

  const fitted = fitFrame(space, frame);

  return (
    <View
      style={styles.stage}
      onLayout={(event) => {
        const next = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
        if (next.width !== space.width || next.height !== space.height) setSpace(next);
      }}
    >
      <VideoView player={player} style={fitted ?? StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} playsInline />
      {failed ? (
        <View style={styles.failed}>
          <Text style={styles.failedText}>This video file could not be played.</Text>
        </View>
      ) : null}
      {!failed && !audible ? (
        <Pressable
          onPress={() => {
            player.muted = false;
            player.play();
            setAudible(true);
          }}
          style={styles.sound}
        >
          <Text style={styles.soundText}>Sound</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function readFrame(player: { videoTrack: { size: { width: number; height: number } } | null }) {
  const size = player.videoTrack?.size;
  if (size?.width && size?.height) return { width: size.width, height: size.height };
  if (Platform.OS !== "web") return null;
  const video = document.querySelector("video");
  if (!video?.videoWidth || !video.videoHeight) return null;
  return { width: video.videoWidth, height: video.videoHeight };
}

function fitFrame(space: { width: number; height: number }, frame: { width: number; height: number } | null) {
  if (!space.width || !space.height || !frame?.width || !frame.height) return null;
  const scale = Math.min(space.width / frame.width, space.height / frame.height);
  const width = Math.round(frame.width * scale);
  const height = Math.round(frame.height * scale);
  return {
    position: "absolute" as const,
    width,
    height,
    left: Math.round((space.width - width) / 2),
    top: Math.round((space.height - height) / 2),
  };
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
  stage: { ...StyleSheet.absoluteFill, backgroundColor: "#000" },
  page: { backgroundColor: "#000" },
  poster: { ...StyleSheet.absoluteFill, backgroundColor: "#161616" },
  failed: { ...StyleSheet.absoluteFill, backgroundColor: "#161616", alignItems: "center", justifyContent: "center", padding: 32 },
  failedText: { color: colors.text, fontSize: 16, textAlign: "center" },
  sound: {
    position: "absolute",
    right: 16,
    bottom: 108,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  soundText: { color: colors.text, fontWeight: "700" },
  back: {
    position: "absolute",
    top: 52,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backText: { color: colors.text, fontWeight: "700" },
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
