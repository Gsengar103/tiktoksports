import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, colors, ErrorText, Field } from "../../src/components/ui";
import { api, Taxonomy } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";

type Issued = { role: string; key: string; url: string };

export default function UploadScreen() {
  const { token } = useSession();
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [caption, setCaption] = useState("");
  const [sportId, setSportId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [status, setStatus] = useState("Choose an mp4 of 60 seconds or less.");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<Taxonomy>("/v1/taxonomy", { token })
      .then((next) => {
        setTaxonomy(next);
        setSportId(next.sports[0]?.id ?? null);
        setTypeId(next.contentTypes[0]?.id ?? null);
        setLevelId(next.levels[0]?.id ?? null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load tags"));
  }, [token]);

  async function publish() {
    if (!token || !sportId || !typeId || !levelId) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("Photo library access is required to choose a video");
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
      });
      if (picked.canceled || !picked.assets[0]) {
        setStatus("No video selected.");
        return;
      }
      const asset = picked.assets[0];
      const durationMs = asset.duration ?? 0;
      if (asset.duration == null) {
        throw new Error("Could not read the video length. Pick an mp4 of 60 seconds or less.");
      }
      if (durationMs < 1 || durationMs > 60_000) {
        throw new Error("Choose a video that is 60 seconds or shorter");
      }
      if (asset.mimeType && asset.mimeType !== "video/mp4") {
        throw new Error("This first version uploads mp4 files");
      }

      setStatus("Making thumbnails");
      const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 0 });
      const small = await manipulateAsync(thumb.uri, [{ resize: { width: 270 } }], { format: SaveFormat.JPEG });
      const large = await manipulateAsync(thumb.uri, [{ resize: { width: 540 } }], { format: SaveFormat.JPEG });

      setStatus("Creating the post");
      const created = await api<{ id: string }>("/v1/videos", {
        token,
        body: { caption, sportId, contentTypeId: typeId, levelId, durationMs: Math.round(durationMs) },
      });
      const issued = await api<{ assets: Issued[] }>(`/v1/videos/${created.id}/upload-urls`, {
        token,
        body: {
          assets: [
            { role: "THUMB_SM", contentType: "image/jpeg" },
            { role: "THUMB_LG", contentType: "image/jpeg" },
            { role: "PREVIEW", contentType: "video/mp4" },
            { role: "PROGRESSIVE", contentType: "video/mp4" },
          ],
        },
      });

      const files: Record<string, string> = {
        THUMB_SM: small.uri,
        THUMB_LG: large.uri,
        PREVIEW: asset.uri,
        PROGRESSIVE: asset.uri,
      };
      for (const item of issued.assets) {
        setStatus(`Uploading ${item.role}`);
        const result = await new File(files[item.role]).upload(item.url, {
          httpMethod: "PUT",
          headers: { "Content-Type": item.role.startsWith("THUMB") ? "image/jpeg" : "video/mp4" },
        });
        if (result.status < 200 || result.status >= 300) {
          throw new Error(`Upload failed for ${item.role} (${result.status})`);
        }
      }

      await api(`/v1/videos/${created.id}/complete`, {
        token,
        body: {
          durationMs: Math.round(durationMs),
          assets: issued.assets.map((item) => ({ role: item.role, key: item.key })),
        },
      });
      setCaption("");
      setStatus("Uploaded. It goes live after the checks pass.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("Upload stopped.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Upload</Text>
      <Text style={styles.status}>{status}</Text>
      <Field label="Caption" value={caption} onChangeText={setCaption} placeholder="What is happening?" />
      <Text style={styles.heading}>Sport</Text>
      <Choices items={taxonomy?.sports ?? []} selected={sportId} onSelect={setSportId} />
      <Text style={styles.heading}>Type</Text>
      <Choices items={taxonomy?.contentTypes ?? []} selected={typeId} onSelect={setTypeId} />
      <Text style={styles.heading}>Level</Text>
      <Choices items={taxonomy?.levels ?? []} selected={levelId} onSelect={setLevelId} />
      <ErrorText message={error} />
      <Button label={busy ? "Working" : "Choose video and publish"} onPress={publish} disabled={busy} />
    </ScrollView>
  );
}

function Choices({
  items,
  selected,
  onSelect,
}: {
  items: { id: string; name: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => onSelect(item.id)} style={[styles.chip, selected === item.id && styles.chipOn]}>
          <Text style={[styles.chipText, selected === item.id && styles.chipTextOn]}>{item.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, padding: 20, paddingTop: 64, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  status: { color: colors.muted },
  heading: { color: colors.text, fontWeight: "600", marginTop: 6 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text },
  chipTextOn: { color: "#111", fontWeight: "700" },
});
