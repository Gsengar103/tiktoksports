import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, ColorValue, Text, View } from "react-native";
import { colors } from "../../src/components/ui";
import { useSession } from "../../src/lib/session";

export default function TabsLayout() {
  const { ready, token, me } = useSession();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!token) return <Redirect href="/login" />;
  if (!me?.profile?.sports.some((sport) => sport.relation === "FOLLOWS")) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#101010",
          borderTopWidth: 0,
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 24,
          position: "absolute",
        },
        tabBarLabelStyle: { fontWeight: "700", fontSize: 11 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="feed" options={{ title: "Feed", tabBarIcon: ({ color }) => <TabMark color={color} mark="▶" /> }} />
      <Tabs.Screen name="search" options={{ title: "Search", tabBarIcon: ({ color }) => <TabMark color={color} mark="⌕" /> }} />
      <Tabs.Screen name="upload" options={{ title: "Post", tabBarIcon: ({ color }) => <TabMark color={color} mark="+" /> }} />
      <Tabs.Screen name="profile" options={{ title: "You", tabBarIcon: ({ color }) => <TabMark color={color} mark="●" /> }} />
    </Tabs>
  );
}

function TabMark({ color, mark }: { color: ColorValue; mark: string }) {
  return <Text style={{ color, fontSize: 16, fontWeight: "800", lineHeight: 18 }}>{mark}</Text>;
}
