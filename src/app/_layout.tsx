import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";

export default function RootLayout() {
  useEffect(() => {
    // Hide the native Expo splash once the React app has mounted.
    SplashScreen.hide();
  }, []);

  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="download" />
        <Stack.Screen name="history" />
      </Stack>
    </>
  );
}
