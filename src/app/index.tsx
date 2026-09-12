import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/download");
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.glowPink} />
      <View style={styles.glowCyan} />

      <View style={styles.logoWrapper}>
        <View style={styles.logoPink} />
        <View style={styles.logoCyan} />

        <View style={styles.logo}>
          <Text style={styles.logoText}>T</Text>
        </View>
      </View>

      <Text style={styles.title}>TikDown</Text>

      <Text style={styles.subtitle}>
        Download. Save. Share.
      </Text>

      <View style={styles.dots}>
        <View style={[styles.dot, styles.pinkDot]} />
        <View style={[styles.dot, styles.cyanDot]} />
        <View style={[styles.dot, styles.purpleDot]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  glowPink: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "#FE2C55",
    opacity: 0.12,
    top: 90,
    left: -100,
  },

  glowCyan: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#25F4EE",
    opacity: 0.1,
    bottom: 70,
    right: -120,
  },

  logoWrapper: {
    width: 105,
    height: 105,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },

  logoPink: {
    position: "absolute",
    width: 82,
    height: 82,
    borderRadius: 24,
    backgroundColor: "#FE2C55",
    transform: [{ translateX: 7 }, { translateY: 7 }],
  },

  logoCyan: {
    position: "absolute",
    width: 82,
    height: 82,
    borderRadius: 24,
    backgroundColor: "#25F4EE",
    transform: [{ translateX: -7 }, { translateY: -7 }],
  },

  logo: {
    width: 82,
    height: 82,
    borderRadius: 24,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 48,
    fontWeight: "900",
  },

  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },

  subtitle: {
    color: "#AFAFAF",
    fontSize: 15,
    marginTop: 7,
  },

  dots: {
    flexDirection: "row",
    marginTop: 25,
    gap: 7,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  pinkDot: {
    backgroundColor: "#FE2C55",
  },

  cyanDot: {
    backgroundColor: "#25F4EE",
  },

  purpleDot: {
    backgroundColor: "#7C3AED",
  },
});
