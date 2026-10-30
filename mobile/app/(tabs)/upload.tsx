import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Chip, colors, ErrorText, Field, ScreenTitle } from "../../src/components/ui";
import { api, Taxonomy } from "../../src/lib/api";
import { putFile } from "../../src/lib/put-file";
import { useSession } from "../../src/lib/session";
import { makeThumbnails } from "../../src/lib/thumbnail";

const debug = process.env.EXPO_PUBLIC_DEBUG === "1";

type Issued = { role: string; key: string; url: string };
type LogLine = { at: string; message: string };

function clock(): string {
  return new Date().toLocaleTimeString();
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export default function UploadScreen() {
  const { token } = useSession();
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [caption, setCaption] = useState("");
  const [sportId, setSportId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [levelId, setLevelId] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function note(message: string) {
    if (!debug) return;
    const line = { at: clock(), message };
    console.log(`[upload ${line.at}] ${message}`);
    setLog((lines) => [...lines, line]);
  }

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
    setStatus(null);
    setLog([]);
    try {
      note("Asking for the photo library");
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("Photo library access is required to choose a video");
      note("Opening the video picker");
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
      });
      if (picked.canceled || !picked.assets[0]) {
        note("Picker closed with no video");
        return;
      }
      const asset = picked.assets[0];
      const durationMs = durationInMs(asset.duration);
      note(
        `Selected ${asset.fileName ?? "video"} · ${asset.mimeType ?? "unknown type"} · ${
          durationMs == null ? "unknown length" : `${Math.round(durationMs / 1000)}s`
        }${asset.fileSize ? ` · ${Math.round(asset.fileSize / 1024)} KB` : ""}`,
      );
      if (durationMs == null) {
        throw new Error("Could not read the video length. Pick an mp4.");
      }
      if (asset.mimeType && asset.mimeType !== "video/mp4") {
        throw new Error("This first version uploads mp4 files");
      }

      note("Making two JPEG thumbnails");
      const thumbs = await makeThumbnails(asset.uri);
      note("Thumbnails ready");

      note("Creating the post");
      const created = await api<{ id: string }>("/v1/videos", {
        token,
        body: { caption, sportId, contentTypeId: typeId, levelId, durationMs: Math.round(durationMs) },
      });
      note(`Post created ${created.id}`);
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
      note(`Received ${issued.assets.length} upload URLs from ${hostOf(issued.assets[0]?.url ?? "")}`);

      const files: Record<string, string> = {
        THUMB_SM: thumbs.smallUri,
        THUMB_LG: thumbs.largeUri,
        PREVIEW: asset.uri,
        PROGRESSIVE: asset.uri,
      };
      for (const item of issued.assets) {
        note(`Uploading ${item.role} to ${hostOf(item.url)}`);
        const contentType = item.role.startsWith("THUMB") ? "image/jpeg" : "video/mp4";
        await putFile(files[item.role], item.url, contentType);
        note(`${item.role} stored`);
      }

      note("Asking the server to finish. This waits up to 20s.");
      const finished = await api<{ status: string; queued: boolean }>(`/v1/videos/${created.id}/complete`, {
        token,
        timeoutMs: 20_000,
        body: {
          durationMs: Math.round(durationMs),
          assets: issued.assets.map((item) => ({ role: item.role, key: item.key })),
        },
      });
      setCaption("");
      if (finished.queued) {
        note(`Finished. Status ${finished.status}. Checks are queued.`);
        setStatus("Posted. It will show in the feed after a quick check.");
      } else {
        note(`Files are saved as ${finished.status}. The check queue did not start, so this video will not go live yet.`);
        setStatus("Saved. It will not go live until checks can run.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      note(`Stopped: ${message}`);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <ScreenTitle kicker="DROP A CLIP" title="Post" subtitle="Pick an mp4." />
      {debug ? (
        <ScrollView style={styles.log} nestedScrollEnabled>
          {log.length === 0 ? <Text style={styles.logLine}>Upload steps show here while debug mode is on.</Text> : null}
          {log.map((line, index) => (
            <Text key={`${line.at}-${index}`} style={styles.logLine}>
              {line.at}  {line.message}
            </Text>
          ))}
        </ScrollView>
      ) : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
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

function durationInMs(duration: number | null | undefined): number | null {
  if (duration == null) return null;
  // The web picker reports seconds. iOS and Android report milliseconds.
  const ms = Platform.OS === "web" ? duration * 1000 : duration;
  return Math.round(ms);
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
        <Chip key={item.id} label={item.name} active={selected === item.id} onPress={() => onSelect(item.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, padding: 20, paddingTop: 64, paddingBottom: 110, gap: 14 },
  log: { backgroundColor: colors.card, borderRadius: 18, padding: 14, gap: 6, maxHeight: 220 },
  logLine: { color: colors.muted, fontSize: 13 },
  status: { color: colors.text, fontSize: 15, fontWeight: "700" },
  heading: { color: colors.text, fontWeight: "800", marginTop: 6, letterSpacing: -0.2 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
