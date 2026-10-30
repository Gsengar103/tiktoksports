import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../src/components/ui";
import { SessionProvider } from "../src/lib/session";

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
