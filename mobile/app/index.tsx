import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { colors } from "../src/components/ui";
import { useSession } from "../src/lib/session";

export default function Index() {
  const { ready, token, me } = useSession();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!token) return <Redirect href="/login" />;
  const followed = me?.profile?.sports.some((sport) => sport.relation === "FOLLOWS");
  if (!followed) return <Redirect href="/onboarding" />;
  return <Redirect href="/feed" />;
}
