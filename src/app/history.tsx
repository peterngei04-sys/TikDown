import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sharing from "expo-sharing";

const HISTORY_KEY = "@tikdown_history";

type HistoryItem = {
  id: string;
  title: string;
  uploader?: string;
  thumbnail?: string | null;
  duration?: number | null;
  localUri: string;
  createdAt: string;
};

export default function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_KEY);

      if (!stored) {
        setHistory([]);
        return;
      }

      const parsed = JSON.parse(stored);

      if (!Array.isArray(parsed)) {
        setHistory([]);
        return;
      }

      setHistory(parsed);
    } catch (error) {
      console.error("History load error:", error);
      setHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
  };

  const formatDuration = (seconds?: number | null) => {
    if (
      typeof seconds !== "number" ||
      !Number.isFinite(seconds)
    ) {
      return "";
    }

    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    return `${minutes}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const shareVideo = async (item: HistoryItem) => {
    try {
      if (!item.localUri) {
        Alert.alert(
          "Video unavailable",
          "This video's saved file is no longer available."
        );
        return;
      }

      const available = await Sharing.isAvailableAsync();

      if (!available) {
        Alert.alert(
          "Sharing unavailable",
          "Sharing is not available on this device."
        );
        return;
      }

      await Sharing.shareAsync(item.localUri);
    } catch (error) {
      console.error("History share error:", error);

      Alert.alert(
        "Share failed",
        "TikDown could not share this video."
      );
    }
  };

  const deleteItem = (id: string) => {
    Alert.alert(
      "Remove from History?",
      "This removes the video from TikDown History. The video in your gallery will not be deleted.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const updated = history.filter(
                (item) => item.id !== id
              );

              await AsyncStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(updated)
              );

              setHistory(updated);
            } catch (error) {
              console.error(
                "Delete history error:",
                error
              );

              Alert.alert(
                "Error",
                "Could not remove this history item."
              );
            }
          },
        },
      ]
    );
  };

  const clearHistory = () => {
    if (history.length === 0) {
      return;
    }

    Alert.alert(
      "Clear History?",
      "All TikDown history records will be removed. Your saved videos will remain in your gallery.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(HISTORY_KEY);
              setHistory([]);
            } catch (error) {
              console.error(
                "Clear history error:",
                error
              );

              Alert.alert(
                "Error",
                "Could not clear History."
              );
            }
          },
        },
      ]
    );
  };

  const renderItem = ({
    item,
  }: {
    item: HistoryItem;
  }) => {
    const duration = formatDuration(item.duration);
    const date = formatDate(item.createdAt);

    return (
      <View style={styles.card}>
        <View style={styles.thumbnailWrapper}>
          {item.thumbnail ? (
            <Image
              source={{ uri: item.thumbnail }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbnailFallback}>
              <Ionicons
                name="logo-tiktok"
                size={30}
                color="#FFFFFF"
              />
            </View>
          )}

          {duration ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {duration}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardContent}>
          <Text
            style={styles.videoTitle}
            numberOfLines={2}
          >
            {item.title || "TikTok Video"}
          </Text>

          {item.uploader ? (
            <Text
              style={styles.uploader}
              numberOfLines={1}
            >
              @{item.uploader}
            </Text>
          ) : null}

          {date ? (
            <Text style={styles.date}>{date}</Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={styles.shareButton}
              onPress={() => shareVideo(item)}
            >
              <Ionicons
                name="share-outline"
                size={17}
                color="#FFFFFF"
              />

              <Text style={styles.shareText}>
                Share
              </Text>
            </Pressable>

            <Pressable
              style={styles.deleteButton}
              onPress={() => deleteItem(item.id)}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color="#FE2C55"
              />
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#111111"
            />
          </Pressable>

          <View>
            <Text style={styles.eyebrow}>
              YOUR LIBRARY
            </Text>

            <Text style={styles.title}>
              History
            </Text>
          </View>

          <View style={styles.placeholder} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#FE2C55"
          />

          <Text style={styles.loadingText}>
            Loading your downloads...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#111111"
          />
        </Pressable>

        <View>
          <Text style={styles.eyebrow}>
            YOUR LIBRARY
          </Text>

          <Text style={styles.title}>
            History
          </Text>
        </View>

        {history.length > 0 ? (
          <Pressable
            style={styles.clearButton}
            onPress={clearHistory}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color="#FE2C55"
            />
          </Pressable>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {history.length === 0 ? (
        <>
          <View style={styles.emptyCard}>
            <View style={styles.iconCircle}>
              <Ionicons
                name="download-outline"
                size={32}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.emptyTitle}>
              No downloads yet
            </Text>

            <Text style={styles.emptyText}>
              Videos you save with TikDown will appear
              here.
            </Text>

            <Pressable
              style={styles.startButton}
              onPress={() =>
                router.replace("/download")
              }
            >
              <Text style={styles.startText}>
                Download a video
              </Text>

              <Ionicons
                name="arrow-forward"
                size={18}
                color="#FFFFFF"
              />
            </Pressable>
          </View>

          <View style={styles.colorRow}>
            <View
              style={[
                styles.colorBlock,
                styles.pink,
              ]}
            />
            <View
              style={[
                styles.colorBlock,
                styles.cyan,
              ]}
            />
            <View
              style={[
                styles.colorBlock,
                styles.purple,
              ]}
            />
            <View
              style={[
                styles.colorBlock,
                styles.yellow,
              ]}
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.countRow}>
            <Text style={styles.countText}>
              {history.length}{" "}
              {history.length === 1
                ? "download"
                : "downloads"}
            </Text>

            <Text style={styles.savedText}>
              Saved videos
            </Text>
          </View>

          <FlatList
            data={history}
            keyExtractor={(item, index) =>
              `${item.id}-${index}`
            }
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              styles.listContent
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#FE2C55"
              />
            }
          />

          <View style={styles.footer}>
            <View
              style={[
                styles.footerLine,
                styles.pink,
              ]}
            />
            <View
              style={[
                styles.footerLine,
                styles.cyan,
              ]}
            />
            <View
              style={[
                styles.footerLine,
                styles.purple,
              ]}
            />
            <View
              style={[
                styles.footerLine,
                styles.yellow,
              ]}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    paddingHorizontal: 20,
    paddingTop: 58,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  backButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },

  clearButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },

  placeholder: {
    width: 46,
  },

  eyebrow: {
    textAlign: "center",
    color: "#FE2C55",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
  },

  title: {
    textAlign: "center",
    color: "#111111",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 2,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    color: "#777777",
    fontSize: 13,
    fontWeight: "600",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    padding: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    marginTop: 8,
  },

  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 25,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  emptyTitle: {
    color: "#111111",
    fontSize: 20,
    fontWeight: "900",
  },

  emptyText: {
    color: "#777777",
    textAlign: "center",
    lineHeight: 20,
    fontSize: 13,
    marginTop: 8,
    maxWidth: 280,
  },

  startButton: {
    marginTop: 22,
    backgroundColor: "#111111",
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  startText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },

  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  countText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "900",
  },

  savedText: {
    color: "#888888",
    fontSize: 12,
    fontWeight: "600",
  },

  listContent: {
    paddingBottom: 25,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },

  thumbnailWrapper: {
    width: 105,
    height: 145,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#111111",
  },

  thumbnail: {
    width: "100%",
    height: "100%",
  },

  thumbnailFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
  },

  durationBadge: {
    position: "absolute",
    bottom: 7,
    right: 7,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  durationText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  cardContent: {
    flex: 1,
    paddingLeft: 13,
    paddingVertical: 2,
  },

  videoTitle: {
    color: "#111111",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },

  uploader: {
    color: "#FE2C55",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 7,
  },

  date: {
    color: "#999999",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 5,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: "auto",
    paddingTop: 10,
    gap: 8,
  },

  shareButton: {
    flex: 1,
    minHeight: 38,
    backgroundColor: "#111111",
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  shareText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#FFF1F3",
    alignItems: "center",
    justifyContent: "center",
  },

  colorRow: {
    flexDirection: "row",
    gap: 7,
    marginTop: 25,
    justifyContent: "center",
  },

  colorBlock: {
    width: 35,
    height: 5,
    borderRadius: 5,
  },

  pink: {
    backgroundColor: "#FE2C55",
  },

  cyan: {
    backgroundColor: "#25F4EE",
  },

  purple: {
    backgroundColor: "#7C3AED",
  },

  yellow: {
    backgroundColor: "#FBBF24",
  },

  footer: {
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 10,
  },

  footerLine: {
    width: 35,
    height: 5,
    borderRadius: 5,
  },
});
