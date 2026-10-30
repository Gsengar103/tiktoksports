import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { api } from "../lib/api";
import { colors } from "./ui";

export function FollowButton({
  creatorId,
  viewerId,
  following,
  token,
  onChange,
}: {
  creatorId: string;
  viewerId: string | null;
  following: boolean;
  token: string | null;
  onChange?: (creatorId: string, following: boolean) => void;
}) {
  const [on, setOn] = useState(following);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOn(following);
  }, [following]);

  if (!token || !viewerId || creatorId === viewerId) return null;

  async function toggle() {
    if (!token || busy) return;
    setBusy(true);
    try {
      const result = await api<{ following: boolean }>(`/v1/users/${creatorId}/follows`, { method: "POST", token });
      setOn(result.following);
      onChange?.(creatorId, result.following);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      onPress={() => void toggle()}
      disabled={busy}
      style={[styles.button, on && styles.on]}
      accessibilityRole="button"
      accessibilityLabel={on ? "Unfollow" : "Follow"}
    >
      <Text pointerEvents="none" style={[styles.label, on && styles.labelOn]}>
        {on ? "Following" : "Follow"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.accent,
  },
  on: { backgroundColor: "rgba(12,12,12,0.55)", borderWidth: 1, borderColor: colors.line },
  label: { color: colors.ink, fontWeight: "800", fontSize: 13 },
  labelOn: { color: colors.text },
});
