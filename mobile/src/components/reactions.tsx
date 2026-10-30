import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    setLikes(initialLikes);
    setLiked(initialLiked);
    touched.current = false;
    setComments([]);
    setDraft("");
    setNote(null);
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

  const bar = (
    <View style={styles.block}>
      <View style={styles.commentRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Comment"
          placeholderTextColor={colors.muted}
          style={styles.commentInput}
          returnKeyType="send"
          onSubmitEditing={() => void comment()}
        />
        <Pressable onPress={() => void comment()} hitSlop={8} style={styles.sendHit}>
          <Text style={styles.send}>Send</Text>
        </Pressable>
      </View>
      {comments.slice(0, 3).map((item) => (
        <Text key={item.id} style={styles.comment} numberOfLines={2}>
          {item.author.displayName}: {item.body}
        </Text>
      ))}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );

  const likeButton = (
    <Pressable onPress={() => void like()} style={styles.like}>
      <Text style={styles.likeText}>{liked ? "Liked" : "Like"}</Text>
      <Text style={styles.likeCount}>{likes}</Text>
    </Pressable>
  );

  return children(bar, likeButton);
}

const styles = StyleSheet.create({
  block: { gap: 4, marginTop: 4 },
  commentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  sendHit: { paddingVertical: 8, paddingHorizontal: 4 },
  send: { color: colors.accent, fontWeight: "700" },
  comment: { color: colors.text, fontSize: 13 },
  note: { color: colors.muted, fontSize: 12 },
  like: { position: "absolute", right: 16, bottom: 36, alignItems: "center", gap: 4 },
  likeText: { color: colors.accent, fontWeight: "700" },
  likeCount: { color: colors.text, fontSize: 12 },
});
