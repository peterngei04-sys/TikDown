import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = "https://tikdown-api-hwwp.onrender.com";
const HISTORY_KEY = "@tikdown_history";

type VideoInfo = {
  id?: string;
  title: string;
  uploader: string;
  thumbnail: string | null;
  duration: number | null;
};

type DownloadItem = VideoInfo & {
  id: string;
  localUri: string;
  createdAt: string;
};

const extractTikTokUrl = (text: string) => {
  const match = text.match(
    /https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s]+/i
  );

  return match
    ? match[0].replace(/[)\],.!?]+$/, "")
    : "";
};

export default function DownloadScreen() {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<VideoInfo | null>(
    null
  );

  const [loadingPreview, setLoadingPreview] =
    useState(false);

  const [downloading, setDownloading] =
    useState(false);

  const [downloadProgress, setDownloadProgress] =
    useState(0);

  const [downloaded, setDownloaded] =
    useState<DownloadItem | null>(null);

  const saveToHistory = async (
    item: DownloadItem
  ) => {
    try {
      const existing =
        await AsyncStorage.getItem(HISTORY_KEY);

      const history: DownloadItem[] = existing
        ? JSON.parse(existing)
        : [];

      const updatedHistory = [
        item,
        ...history.filter(
          (oldItem) =>
            oldItem.localUri !== item.localUri
        ),
      ];

      await AsyncStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(updatedHistory)
      );

      console.log(
        "History saved successfully:",
        item.title
      );
    } catch (error) {
      console.error(
        "History save error:",
        error
      );
    }
  };

  const saveVideoToGallery = async (
    localUri: string
  ) => {
    const permission =
      await MediaLibrary.requestPermissionsAsync();

    if (!permission.granted) {
      throw new Error(
        "TikDown needs permission to save videos to your phone."
      );
    }

    const asset =
      await MediaLibrary.createAssetAsync(
        localUri
      );

    const album =
      await MediaLibrary.getAlbumAsync(
        "TikDown"
      );

    if (album) {
      await MediaLibrary.addAssetsToAlbumAsync(
        [asset],
        album,
        false
      );
    } else {
      await MediaLibrary.createAlbumAsync(
        "TikDown",
        asset,
        false
      );
    }

    return asset;
  };

  const handlePaste = async () => {
    try {
      const text =
        await Clipboard.getStringAsync();

      if (!text) {
        Alert.alert(
          "Clipboard empty",
          "Copy a TikTok link first."
        );
        return;
      }

      const extracted =
        extractTikTokUrl(text);

      if (!extracted) {
        Alert.alert(
          "Invalid link",
          "The clipboard does not contain a valid TikTok link."
        );
        return;
      }

      setUrl(extracted);
      setPreview(null);
      setDownloaded(null);
    } catch (error) {
      console.error(
        "Clipboard error:",
        error
      );

      Alert.alert(
        "Paste failed",
        "TikDown could not read your clipboard."
      );
    }
  };

  const handlePreview = async () => {
    const extracted =
      extractTikTokUrl(url.trim());

    if (!extracted) {
      Alert.alert(
        "Invalid TikTok link",
        "Please paste a valid TikTok video link."
      );
      return;
    }

    setLoadingPreview(true);
    setPreview(null);
    setDownloaded(null);

    try {
      console.log(
        "Sending preview URL to TikDown API:",
        extracted
      );

      const response = await fetch(
        `${BACKEND_URL}/api/preview`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            url: extracted,
          }),
        }
      );

      const data = await response.json();

      console.log(
        "Preview API response:",
        data
      );

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Could not load video preview."
        );
      }

      setUrl(extracted);

      setPreview({
        id: data.id,
        title:
          data.title ||
          "TikTok Video",
        uploader:
          data.uploader || "",
        thumbnail:
          data.thumbnail || null,
        duration:
          typeof data.duration ===
          "number"
            ? data.duration
            : null,
      });
    } catch (error) {
      console.error(
        "Preview error:",
        error
      );

      Alert.alert(
        "Preview failed",
        error instanceof Error
          ? error.message
          : "Could not load this TikTok video."
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async () => {
    if (!preview) {
      await handlePreview();
      return;
    }

    if (downloading) {
      return;
    }

    setDownloading(true);
    setDownloaded(null);
    setDownloadProgress(0);

    try {
      const extracted =
        extractTikTokUrl(url.trim());

      if (!extracted) {
        throw new Error(
          "Please enter a valid TikTok link."
        );
      }

      console.log(
        "Sending URL to TikDown API:",
        extracted
      );

      const response = await fetch(
        `${BACKEND_URL}/api/download`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            url: extracted,
          }),
        }
      );

      const data = await response.json();

      console.log(
        "API response:",
        data
      );

      if (
        !response.ok ||
        !data.success ||
        !data.videoUrl
      ) {
        throw new Error(
          data.error ||
            "The server could not prepare this video."
        );
      }

      const videoUrl = data.videoUrl.startsWith(
        "http"
      )
        ? data.videoUrl
        : `${BACKEND_URL}${data.videoUrl}`;

      const fileUri =
        `${
          FileSystem.cacheDirectory
        }tikdown_${Date.now()}.mp4`;

      console.log(
        "Downloading video to:",
        fileUri
      );

      const downloadResumable =
        FileSystem.createDownloadResumable(
          videoUrl,
          fileUri,
          {},
          (progress) => {
            if (
              progress.totalBytesExpectedToWrite >
              0
            ) {
              const value =
                progress.totalBytesWritten /
                progress.totalBytesExpectedToWrite;

              setDownloadProgress(
                Math.min(value, 1)
              );
            }
          }
        );

      const downloadResult =
        await downloadResumable.downloadAsync();

      if (!downloadResult?.uri) {
        throw new Error(
          "The video download failed."
        );
      }

      setDownloadProgress(1);

      console.log(
        "Video downloaded locally:",
        downloadResult.uri
      );

      await saveVideoToGallery(
        downloadResult.uri
      );

      const historyItem: DownloadItem = {
        id:
          data.id ||
          preview.id ||
          `${Date.now()}`,

        title:
          data.title ||
          preview.title ||
          "TikTok Video",

        uploader:
          data.uploader ||
          preview.uploader ||
          "",

        thumbnail:
          data.thumbnail ||
          preview.thumbnail ||
          null,

        duration:
          typeof data.duration ===
          "number"
            ? data.duration
            : preview.duration,

        localUri:
          downloadResult.uri,

        createdAt:
          new Date().toISOString(),
      };

      await saveToHistory(
        historyItem
      );

      setDownloaded(historyItem);

      Alert.alert(
        "Download complete",
        "Your video has been saved to the TikDown album and added to History."
      );
    } catch (error) {
      console.error(
        "Download error:",
        error
      );

      Alert.alert(
        "Download failed",
        error instanceof Error
          ? error.message
          : "Something went wrong while downloading the video."
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!downloaded?.localUri) {
      return;
    }

    if (downloading) {
      return;
    }

    try {
      const available =
        await Sharing.isAvailableAsync();

      if (!available) {
        Alert.alert(
          "Sharing unavailable",
          "Sharing is not available on this device."
        );
        return;
      }

      await Sharing.shareAsync(
        downloaded.localUri,
        {
          mimeType: "video/mp4",
          dialogTitle:
            "Share TikDown video",
        }
      );
    } catch (error) {
      console.error(
        "Share error:",
        error
      );

      Alert.alert(
        "Share failed",
        "The video could not be shared right now."
      );
    }
  };

  const clearCurrent = () => {
    setUrl("");
    setPreview(null);
    setDownloaded(null);
    setDownloadProgress(0);
  };

  const formatDuration = (
    seconds: number | null
  ) => {
    if (
      seconds === null ||
      seconds === undefined
    ) {
      return "";
    }

    const minutes = Math.floor(
      seconds / 60
    );

    const remaining = Math.floor(
      seconds % 60
    );

    if (minutes === 0) {
      return `${remaining}s`;
    }

    return `${minutes}:${remaining
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>
              TIKDOWN
            </Text>

            <Text style={styles.title}>
              Download videos.
            </Text>

            <Text style={styles.subtitle}>
              Fast, simple and without the watermark.
            </Text>
          </View>

          <Pressable
            style={styles.historyButton}
            onPress={() =>
              router.push("/history")
            }
          >
            <Ionicons
              name="time-outline"
              size={21}
              color="#111111"
            />
          </Pressable>
        </View>

        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <View
              style={styles.linkIcon}
            >
              <Ionicons
                name="link-outline"
                size={20}
                color="#111111"
              />
            </View>

            <Text
              style={styles.inputLabel}
            >
              TikTok video link
            </Text>
          </View>

          <TextInput
            value={url}
            onChangeText={(text) => {
              setUrl(text);
              setPreview(null);
              setDownloaded(null);
            }}
            placeholder="Paste TikTok link here..."
            placeholderTextColor="#999999"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />

          <View style={styles.inputActions}>
            <Pressable
              style={styles.pasteButton}
              onPress={handlePaste}
            >
              <Ionicons
                name="clipboard-outline"
                size={17}
                color="#111111"
              />

              <Text
                style={styles.pasteText}
              >
                Paste
              </Text>
            </Pressable>

            {url.length > 0 ? (
              <Pressable
                style={styles.clearInput}
                onPress={clearCurrent}
              >
                <Ionicons
                  name="close-circle"
                  size={21}
                  color="#999999"
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        <Pressable
          style={[
            styles.previewButton,
            loadingPreview &&
              styles.disabledButton,
          ]}
          onPress={handlePreview}
          disabled={loadingPreview}
        >
          {loadingPreview ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Ionicons
              name="eye-outline"
              size={20}
              color="#FFFFFF"
            />
          )}

          <Text
            style={styles.previewButtonText}
          >
            {loadingPreview
              ? "Loading..."
              : "Preview video"}
          </Text>
        </Pressable>

        {preview ? (
          <View style={styles.previewCard}>
            <View
              style={styles.previewImageWrapper}
            >
              {preview.thumbnail ? (
                <Image
                  source={{
                    uri: preview.thumbnail,
                  }}
                  style={
                    styles.previewImage
                  }
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={
                    styles.thumbnailFallback
                  }
                >
                  <Ionicons
                    name="play"
                    size={38}
                    color="#FFFFFF"
                  />
                </View>
              )}

              {preview.duration !==
              null ? (
                <View
                  style={
                    styles.durationBadge
                  }
                >
                  <Text
                    style={
                      styles.durationText
                    }
                  >
                    {formatDuration(
                      preview.duration
                    )}
                  </Text>
                </View>
              ) : null}
            </View>

            <View
              style={styles.previewContent}
            >
              <Text
                style={styles.videoTitle}
                numberOfLines={3}
              >
                {preview.title}
              </Text>

              {preview.uploader ? (
                <Text
                  style={
                    styles.uploader
                  }
                  numberOfLines={1}
                >
                  @{preview.uploader}
                </Text>
              ) : null}
            </View>

            <Pressable
              style={[
                styles.downloadButton,
                downloading &&
                  styles.disabledButton,
              ]}
              onPress={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <Ionicons
                  name="download-outline"
                  size={21}
                  color="#FFFFFF"
                />
              )}

              <Text
                style={
                  styles.downloadButtonText
                }
              >
                {downloading
                  ? "Downloading..."
                  : "Download video"}
              </Text>
            </Pressable>

            {downloading ? (
              <View
                style={
                  styles.progressSection
                }
              >
                <View
                  style={
                    styles.progressTrack
                  }
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${
                          downloadProgress *
                          100
                        }%`,
                      },
                    ]}
                  />
                </View>

                <Text
                  style={
                    styles.progressText
                  }
                >
                  {Math.round(
                    downloadProgress * 100
                  )}
                  %
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {downloaded ? (
          <View
            style={styles.successCard}
          >
            <View
              style={styles.successIcon}
            >
              <Ionicons
                name="checkmark"
                size={25}
                color="#FFFFFF"
              />
            </View>

            <View
              style={styles.successContent}
            >
              <Text
                style={
                  styles.successTitle
                }
              >
                Video saved
              </Text>

              <Text
                style={
                  styles.successText
                }
              >
                Saved to your TikDown album and History.
              </Text>
            </View>

            <Pressable
              style={styles.shareButton}
              onPress={handleShare}
            >
              <Ionicons
                name="share-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text
                style={styles.shareText}
              >
                Share
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={21}
              color="#111111"
            />
          </View>

          <View
            style={styles.infoContent}
          >
            <Text style={styles.infoTitle}>
              Simple & private
            </Text>

            <Text style={styles.infoText}>
              Your downloaded videos are saved directly on your device.
            </Text>
          </View>
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

        <Text style={styles.footer}>
          © TikDown • Powered by PECO
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 30,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 25,
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#FE2C55",
    marginBottom: 6,
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#111111",
    letterSpacing: -1,
  },

  subtitle: {
    marginTop: 7,
    fontSize: 14,
    color: "#777777",
    lineHeight: 20,
    maxWidth: 280,
  },

  historyButton: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },

  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 17,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    marginBottom: 13,
  },

  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  linkIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: "#F1F1F1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#222222",
  },

  input: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#F7F7F8",
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111111",
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },

  inputActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 11,
  },

  pasteButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F1F1F1",
  },

  pasteText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#111111",
  },

  clearInput: {
    padding: 5,
  },

  previewButton: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginBottom: 18,
  },

  previewButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 9,
  },

  disabledButton: {
    opacity: 0.65,
  },

  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    marginBottom: 16,
  },

  previewImageWrapper: {
    height: 220,
    width: "100%",
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#111111",
    position: "relative",
  },

  previewImage: {
    width: "100%",
    height: "100%",
  },

  thumbnailFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222222",
  },

  durationBadge: {
    position: "absolute",
    right: 9,
    bottom: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "rgba(0,0,0,0.75)",
  },

  durationText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  previewContent: {
    paddingHorizontal: 5,
    paddingTop: 14,
    paddingBottom: 12,
  },

  videoTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: "#111111",
  },

  uploader: {
    marginTop: 7,
    fontSize: 13,
    color: "#777777",
    fontWeight: "600",
  },

  downloadButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#FE2C55",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: 2,
  },

  downloadButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginLeft: 9,
  },

  progressSection: {
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  progressTrack: {
    flex: 1,
    height: 7,
    borderRadius: 5,
    backgroundColor: "#EEEEEE",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#FE2C55",
  },

  progressText: {
    width: 42,
    marginLeft: 10,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
    color: "#555555",
  },

  successCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  successIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },

  successContent: {
    flex: 1,
    marginLeft: 11,
    marginRight: 8,
  },

  successTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111111",
  },

  successText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: "#777777",
  },

  shareButton: {
    backgroundColor: "#111111",
    borderRadius: 11,
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  shareText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 5,
  },

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#F1F1F1",
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
    marginLeft: 11,
  },

  infoTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111111",
  },

  infoText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: "#777777",
  },

  colorRow: {
    height: 5,
    borderRadius: 4,
    overflow: "hidden",
    flexDirection: "row",
    marginTop: 30,
  },

  colorBlock: {
    flex: 1,
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
    backgroundColor: "#FACC15",
  },

  footer: {
    textAlign: "center",
    marginTop: 13,
    fontSize: 11,
    color: "#999999",
    fontWeight: "600",
  },
});
