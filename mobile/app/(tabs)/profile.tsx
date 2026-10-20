import { router } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Button, colors } from "../../src/components/ui";
import { api } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";

export default function ProfileScreen() {
  const { me, token, signOut } = useSession();
  const sports = me?.profile?.sports.map((sport) => sport.sportId.replace("sport.", "")).join(", ");

  async function removeAccount() {
    if (!token) return;
    await api("/v1/me", { method: "DELETE", token });
    await signOut();
    router.replace("/login");
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{me?.displayName}</Text>
      <Text style={styles.meta}>{me?.email}</Text>
      <Text style={styles.meta}>Age band {me?.ageBand}</Text>
      <Text style={styles.meta}>Goal {me?.profile?.goal ?? "not set"}</Text>
      <Text style={styles.meta}>Sports {sports || "none yet"}</Text>
      <Button
        label="Sign out"
        onPress={() => {
          void signOut().then(() => router.replace("/login"));
        }}
      />
      <Button
        label="Delete account"
        onPress={() =>
          Alert.alert("Delete account", "This removes your account and takes your videos down.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => void removeAccount() },
          ])
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 72, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 16 },
});
