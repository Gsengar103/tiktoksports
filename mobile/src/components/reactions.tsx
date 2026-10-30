import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { ApiError, api } from "../lib/api";
import { useSession } from "../lib/session";
import { colors } from "./ui";

type VideoComment = {
  id: string;
  body: string;
  author: { id: string; displayName: string };
};

export function Reactions({
  videoId,
  token,
  active,
  initialLikes,
  initialLiked = false,
  children,
}: {
  videoId: string;
  token: string | null;
  active: boolean;
  initialLikes: number;
  initialLiked?: boolean;
  children: (bar: ReactNode, like: ReactNode) => ReactNode;
}) {
  const { me } = useSession();
  const { height: windowHeight } = useWindowDimensions();
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touched = useRef(false);
  const commentLimit = me?.ageBand === "AGE_18_PLUS" ? 1000 : 280;
  const sheetHeight = Math.round(windowHeight * 0.5);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        setDragY(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 56) setOpen(false);
        setDragY(0);
      },
      onPanResponderTerminate: () => setDragY(0),
    }),
  ).current;

  useEffect(() => {
    setLikes(initialLikes);
    setLiked(initialLiked);
    touched.current = false;
    setComments([]);
    setDraft("");
    setNote(null);
    setOpen(false);
    setDragY(0);
  }, [videoId, initialLikes, initialLiked]);

  useEffect(() => {
    if (!active || !token) return;
    let cancelled = false;
    api<{ liked: boolean; comments: VideoComment[] }>(`/v1/videos/${videoId}/comments`, { token })
      .then((response) => {
        if (cancelled) return;
        setComments(response.comments);
        if (!touched.current) setLiked(response.liked);
      })
      .catch(() => {
        if (!cancelled) setNote("Comments could not be loaded");
      });
    return () => {
      cancelled = true;
    };
  }, [active, token, videoId]);

  function closeSheet() {
    setDragY(0);
    setOpen(false);
  }

  async function like() {
    if (!token) return;
    touched.current = true;
    try {
      const result = await api<{ liked: boolean }>(`/v1/videos/${videoId}/likes`, { method: "POST", token });
      setLiked(result.liked);
      setLikes((count) => Math.max(0, count + (result.liked ? 1 : -1)));
      setNote(null);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not like this video");
    }
  }

  async function comment() {
    const body = draft.trim();
    if (!token || !body) return;
    try {
      const created = await api<{ id: string }>(`/v1/videos/${videoId}/comments`, { token, body: { body } });
      setComments((current) => [
        { id: created.id, body, author: { id: me?.id ?? "", displayName: me?.displayName ?? "You" } },
        ...current,
      ]);
      setDraft("");
      setNote(null);
    } catch (err) {
      setNote(err instanceof ApiError && err.status === 401 ? "Sign in again to comment" : err instanceof Error ? err.message : "Could not send the comment");
    }
  }

  const preview = comments[0];

  const bar = (
    <View style={styles.block}>
      {preview ? (
        <Text style={styles.comment} numberOfLines={2}>
          <Text style={styles.author}>{preview.author.displayName}</Text>
          {`  ${preview.body}`}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={styles.moreHit}
        accessibilityRole="button"
        accessibilityLabel="View comments"
      >
        <Text style={styles.more} pointerEvents="none">
          View comments
        </Text>
      </Pressable>
      {note && !open ? <Text style={styles.note}>{note}</Text> : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={[styles.modalRoot, { height: windowHeight }]}>
          <Pressable style={styles.backdrop} onPress={closeSheet} accessibilityRole="button" accessibilityLabel="Dismiss comments" />
          <View style={[styles.sheet, { height: sheetHeight, transform: [{ translateY: dragY }] }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.handleHit} {...pan.panHandlers}>
                <Pressable onPress={closeSheet} hitSlop={8} accessibilityRole="button" accessibilityLabel="Drag to close">
                  <View style={styles.handle} pointerEvents="none" />
                </Pressable>
              </View>
              <Text style={styles.sheetTitle} pointerEvents="none">
                Comments
              </Text>
              <Pressable onPress={closeSheet} hitSlop={8} style={styles.closeHit} accessibilityRole="button" accessibilityLabel="Close comments">
                <Ionicons name="close" size={22} color={colors.text} pointerEvents="none" />
              </Pressable>
            </View>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.listContent}>
              {comments.length === 0 ? <Text style={styles.empty}>No comments yet</Text> : null}
              {comments.map((item) => (
                <View key={item.id} style={styles.commentItem}>
                  <Text style={styles.author}>{item.author.displayName}</Text>
                  <Text style={styles.commentBody}>{item.body}</Text>
                </View>
              ))}
            </ScrollView>
            {note ? <Text style={styles.note}>{note}</Text> : null}
            <View style={styles.commentRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Comment"
                placeholderTextColor={colors.muted}
                style={styles.commentInput}
                maxLength={commentLimit}
                returnKeyType="send"
                onSubmitEditing={() => void comment()}
              />
              <Pressable
                onPress={() => void comment()}
                hitSlop={8}
                style={styles.sendHit}
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                <Ionicons name="paper-plane" size={22} color={draft.trim() ? colors.accent : colors.muted} pointerEvents="none" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  const likeButton = (
    <Pressable onPress={() => void like()} style={styles.like} accessibilityRole="button" accessibilityLabel={liked ? "Liked" : "Like"}>
      <Ionicons name={liked ? "heart" : "heart-outline"} size={26} color={liked ? colors.accent : colors.text} pointerEvents="none" />
      <Text style={styles.likeCount} pointerEvents="none">
        {likes}
      </Text>
    </Pressable>
  );

  return children(bar, likeButton);
}

const styles = StyleSheet.create({
  block: { gap: 4, marginTop: 4 },
  moreHit: { alignSelf: "flex-start", paddingVertical: 4 },
  more: { color: colors.accent, fontWeight: "800", fontSize: 13 },
  comment: { color: colors.text, fontSize: 13, lineHeight: 18 },
  author: { color: colors.text, fontWeight: "800" },
  note: { color: colors.muted, fontSize: 12 },
  modalRoot: { justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(5,5,5,0.45)", zIndex: 1 },
  sheet: {
    zIndex: 2,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
    overflow: "hidden",
  },
  sheetHeader: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  handleHit: { position: "absolute", top: 0, left: 64, right: 64, alignItems: "center", paddingTop: 8, paddingBottom: 12 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: "#6a6a6a" },
  sheetTitle: { color: colors.text, fontWeight: "800", fontSize: 16 },
  closeHit: {
    position: "absolute",
    right: 0,
    top: 4,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 8, gap: 4 },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: 12 },
  commentItem: { gap: 2, paddingVertical: 8 },
  commentBody: { color: colors.text, fontSize: 15, lineHeight: 20 },
  commentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentInput: {
    flex: 1,
    color: colors.text,
    borderWidth: 0,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#050505",
  },
  sendHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  like: {
    position: "absolute",
    right: 16,
    bottom: 108,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: "rgba(12,12,12,0.55)",
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  likeCount: { color: colors.text, fontSize: 13, fontWeight: "800" },
});
