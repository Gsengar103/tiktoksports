import { Ionicons } from "@expo/vector-icons";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { Dimensions, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { api, FeedVideo, PublicVideo } from "../lib/api";
import { useSession } from "../lib/session";
import { FollowButton } from "./follow";
import { Reactions } from "./reactions";
import { usePlayedDuration, useWatchReport } from "../lib/watch-report";
import { colors } from "./ui";

export function WatchSession({
  videos,
  token,
  onClose,
}: {
  videos: FeedVideo[];
  token: string | null;
  onClose: () => void;
}) {
  const { me } = useSession();
  const [items, setItems] = useState(videos);
  const [active, setActive] = useState(0);
  const [pageHeight, setPageHeight] = useState(Dimensions.get("window").height);

  useEffect(() => {
    setItems(videos);
    setActive(0);
  }, [videos]);

  function onFollow(creatorId: string, following: boolean) {
    setItems((current) => current.map((video) => (video.creator.id === creatorId ? { ...video, following } : video)));
  }

  return (
    <View
      style={styles.fill}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.height);
        if (next > 0 && next !== pageHeight) setPageHeight(next);
      }}
    >
      <FlatList
        data={items}
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
          const next = pageIndex(event.nativeEvent.contentOffset.y, pageHeight, items.length);
          setActive((current) => (current === next ? current : next));
        }}
        onMomentumScrollEnd={(event) => setActive(pageIndex(event.nativeEvent.contentOffset.y, pageHeight, items.length))}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <WatchPage
            item={item}
            active={index === active}
            height={pageHeight}
            token={token}
            viewerId={me?.id ?? null}
            more={index < items.length - 1}
            onFollow={onFollow}
          />
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
  viewerId,
  more,
  onFollow,
}: {
  item: FeedVideo;
  active: boolean;
  height: number;
  token: string | null;
  viewerId: string | null;
  more: boolean;
  onFollow: (creatorId: string, following: boolean) => void;
}) {
  const [playback, setPlayback] = useState<string | null>(null);
  const reportDuration = useWatchReport(item.id, token, active);

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
    return () => {
      cancelled = true;
    };
  }, [active, item.id, token]);

  return (
    <Reactions videoId={item.id} token={token} active={active} initialLikes={item.counts?.likes ?? 0} initialLiked={item.liked}>
      {(bar, like) => (
        <View style={[styles.page, { height }]}>
          {active && playback ? <Player url={playback} onWatch={reportDuration} /> : <View style={styles.poster} />}
          <View style={styles.meta}>
            <View style={styles.creatorRow}>
              <Text style={styles.creator}>{item.creator.displayName}</Text>
              <FollowButton
                creatorId={item.creator.id}
                viewerId={viewerId}
                following={item.following === true}
                token={token}
                onChange={onFollow}
              />
            </View>
            <Text style={styles.caption}>{item.caption || "Untitled"}</Text>
            <Text style={styles.tags}>
              {item.sportId.replace("sport.", "")} · {item.levelId.replace("level.", "")}
            </Text>
            <Text style={styles.tags}>{more ? "Swipe up for a similar video" : "That's the last similar video"}</Text>
            {bar}
          </View>
          {like}
        </View>
      )}
    </Reactions>
  );
}

function pageIndex(offset: number, pageHeight: number, count: number) {
  if (pageHeight <= 0 || count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(offset / pageHeight)));
}

function playableAsset(assets: { role: string; url: string }[]) {
  return assets.find((asset) => asset.role === "PROGRESSIVE") ?? assets.find((asset) => asset.role === "PREVIEW");
}

function Player({ url, onWatch }: { url: string; onWatch: (durationMs: number) => void }) {
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

  usePlayedDuration(player, onWatch);

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
      {!failed ? (
        <Pressable
          onPress={() => {
            const next = !audible;
            player.muted = !next;
            if (next) player.play();
            setAudible(next);
          }}
          style={styles.sound}
          accessibilityRole="button"
          accessibilityLabel={audible ? "Mute sound" : "Turn sound on"}
        >
          <Ionicons name={audible ? "volume-high" : "volume-mute"} size={22} color={colors.text} pointerEvents="none" />
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
    bottom: 176,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12,12,12,0.55)",
    borderRadius: 22,
  },
  back: {
    position: "absolute",
    top: 52,
    left: 16,
    backgroundColor: "rgba(12,12,12,0.55)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backText: { color: colors.text, fontWeight: "800" },
  meta: { position: "absolute", left: 16, right: 88, bottom: 96, gap: 6 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  creator: { color: colors.text, fontWeight: "800", fontSize: 17, flexShrink: 1 },
  caption: { color: colors.text, fontSize: 15, lineHeight: 20 },
  tags: { color: colors.accent, fontSize: 13, fontWeight: "700" },
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
