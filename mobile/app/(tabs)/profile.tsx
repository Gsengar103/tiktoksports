import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ProfileForm } from "../../src/components/profile-form";
import { Button, colors } from "../../src/components/ui";
import { api, Profile, Taxonomy } from "../../src/lib/api";
import { useSession } from "../../src/lib/session";

type LibraryVideo = {
  id: string;
  caption: string;
  status: string;
  sportId: string;
  durationMs: number;
  createdAt: string;
  views: number;
  counts: { likes: number; saves: number; comments: number };
  thumbUrl: string | null;
};

type Analytics = {
  id: string;
  caption: string;
  status: string;
  totals: { views: number; likes: number; saves: number; comments: number };
  days: { day: string; views: number }[];
  audiences: { ageBand: string; views: number }[];
};

const AGE_LABEL: Record<string, string> = {
  AGE_13_15: "13–15",
  AGE_16_17: "16–17",
  AGE_18_PLUS: "18+",
};

const KIND_LABEL: Record<Profile["kind"], string> = {
  PLAYER: "Player",
  COACH: "Coach",
  ACADEMY: "Academy",
};

const BATCH_LABEL: Record<string, string> = {
  MORNING: "Morning",
  EVENING: "Evening",
  WEEKEND: "Weekend",
};

export default function ProfileScreen() {
  const { me, token, signOut, saveProfile, refreshMe } = useSession();
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);

  useEffect(() => {
    if (!token) return;
    api<Taxonomy>("/v1/taxonomy", { token }).then(setTaxonomy).catch(() => undefined);
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api<{ videos: LibraryVideo[] }>("/v1/me/videos", { token });
      setVideos(response.videos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your videos");
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function openAnalytics(id: string) {
    if (!token) return;
    setSelectedId(id);
    try {
      const next = await api<Analytics>(`/v1/me/videos/${id}/analytics`, { token });
      setAnalytics(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load analytics");
    }
  }

  const views = videos.reduce((sum, video) => sum + video.views, 0);
  const likes = videos.reduce((sum, video) => sum + video.counts.likes, 0);
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {me?.profile ? <ProfileCard name={me.displayName} email={me.email} ageBand={me.ageBand} profile={me.profile} /> : null}

      <View style={styles.stats}>
        <Stat label="Videos" value={String(videos.length)} />
        <Stat label="Views" value={String(views)} />
        <Stat label="Likes" value={String(likes)} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.heading}>Edit profile</Text>
      <ProfileForm
        token={token}
        taxonomy={taxonomy}
        profile={me?.profile ?? null}
        submitLabel="Save profile"
        onSubmit={saveProfile}
        onChanged={refreshMe}
      />

      <Text style={styles.heading}>Your videos</Text>
      {videos.length === 0 ? <Text style={styles.meta}>Uploads show here, including ones still being checked.</Text> : null}
      {videos.map((video) => (
        <Pressable key={video.id} onPress={() => void openAnalytics(video.id)} style={[styles.card, selectedId === video.id && styles.cardOn]}>
          {video.thumbUrl ? <Image source={{ uri: video.thumbUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
          <View style={styles.cardBody}>
            <Text style={styles.caption}>{video.caption || "Untitled"}</Text>
            <Text style={styles.meta}>
              {video.sportId.replace("sport.", "")} · {Math.round(video.durationMs / 1000)}s
            </Text>
            <Text style={styles.meta}>
              {video.views} views · {video.counts.likes} likes · {video.counts.comments} comments
            </Text>
          </View>
          <Text style={[styles.pill, video.status === "LIVE" && styles.pillLive]}>{video.status}</Text>
        </Pressable>
      ))}

      {analytics && selectedId === analytics.id ? <AnalyticsPanel analytics={analytics} /> : null}

      <Button label="Sign out" onPress={() => void signOut().then(() => router.replace("/login"))} />
      <Button label="Delete account" onPress={() => confirmDelete(token, signOut)} />
    </ScrollView>
  );
}

function AnalyticsPanel({ analytics }: { analytics: Analytics }) {
  const peak = Math.max(1, ...analytics.days.map((day) => day.views));
  const audiencePeak = Math.max(1, ...analytics.audiences.map((row) => row.views));
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>{analytics.caption || "Untitled"}</Text>
      <Text style={styles.meta}>Last 14 days. A view is counted when someone else plays the video in the feed.</Text>
      <View style={styles.stats}>
        <Stat label="Views" value={String(analytics.totals.views)} />
        <Stat label="Likes" value={String(analytics.totals.likes)} />
        <Stat label="Saves" value={String(analytics.totals.saves)} />
        <Stat label="Comments" value={String(analytics.totals.comments)} />
      </View>
      <Text style={styles.subhead}>Views by day</Text>
      {analytics.days.map((day) => (
        <View key={day.day} style={styles.barRow}>
          <Text style={styles.barLabel}>{day.day.slice(5)}</Text>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${Math.round((day.views / peak) * 100)}%` }]} />
          </View>
          <Text style={styles.barValue}>{day.views}</Text>
        </View>
      ))}
      <Text style={styles.subhead}>Who watched</Text>
      {analytics.audiences.map((row) => (
        <View key={row.ageBand} style={styles.barRow}>
          <Text style={styles.barLabel}>{AGE_LABEL[row.ageBand] ?? row.ageBand}</Text>
          <View style={styles.track}>
            <View style={[styles.bar, styles.barAlt, { width: `${Math.round((row.views / audiencePeak) * 100)}%` }]} />
          </View>
          <Text style={styles.barValue}>{row.views}</Text>
        </View>
      ))}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.meta}>{label}</Text>
    </View>
  );
}

function ProfileCard({ name, email, ageBand, profile }: { name: string; email: string | null; ageBand: string; profile: Profile }) {
  const portrait = profile.photos.find((photo) => photo.role === "PORTRAIT" || photo.role === "LOGO");
  const cover = profile.photos.find((photo) => photo.role === "COVER");
  const gallery = profile.photos.filter((photo) => photo.role === "GALLERY");
  const title = profile.kind === "ACADEMY" && profile.academyName ? profile.academyName : name;
  const sport = profile.sports.find((item) => item.relation === "FOLLOWS");
  const place = [profile.area, profile.city, profile.groundName].filter(Boolean).join(", ");
  const ages = profile.ageGroups.map((group) => AGE_LABEL[group] ?? group).join(" · ");
  const batches = profile.batches.map((batch) => BATCH_LABEL[batch] ?? batch).join(" · ");
  const initial = title.slice(0, 1).toUpperCase();
  return (
    <View style={styles.cardBlock}>
      {cover ? <Image source={{ uri: cover.url }} style={styles.cover} /> : null}
      <View style={styles.header}>
        {portrait ? (
          <Image source={{ uri: portrait.url }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}
        <View style={styles.identity}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>{KIND_LABEL[profile.kind]}{sport ? ` · ${sport.sportId.replace("sport.", "")}` : ""}</Text>
          {profile.kind === "ACADEMY" ? <Text style={styles.meta}>{name}</Text> : null}
          {email ? <Text style={styles.meta}>{email}</Text> : null}
          {place ? (
            <Text style={styles.meta}>
              {place}
              {profile.cityVisible ? "" : " · private"}
            </Text>
          ) : null}
          {profile.kind === "PLAYER" ? <Text style={styles.meta}>{labelGoal(profile.goal)}</Text> : null}
          {profile.kind === "COACH" && profile.academyName ? <Text style={styles.meta}>{profile.academyName}</Text> : null}
          {profile.yearsCoaching != null ? <Text style={styles.meta}>{profile.yearsCoaching} years coaching</Text> : null}
          {profile.qualification ? <Text style={styles.meta}>{profile.qualification}</Text> : null}
          {profile.establishedYear ? <Text style={styles.meta}>Started {profile.establishedYear}</Text> : null}
          {ages ? <Text style={styles.meta}>Ages {ages}</Text> : null}
          {batches ? <Text style={styles.meta}>{batches}</Text> : null}
          {profile.about ? <Text style={styles.meta}>{profile.about}</Text> : null}
          {profile.aboutPlay ? <Text style={styles.meta}>{profile.aboutPlay}</Text> : null}
          {profile.coachesWhat ? <Text style={styles.meta}>Coaches {profile.coachesWhat}</Text> : null}
          {profile.achievements ? <Text style={styles.meta}>{profile.achievements}</Text> : null}
          {profile.trialNote ? <Text style={styles.meta}>{profile.trialNote}</Text> : null}
          {profile.linkUrl ? (
            <Pressable onPress={() => void Linking.openURL(profile.linkUrl!)}>
              <Text style={styles.link}>{profile.kind === "ACADEMY" ? "Visit academy" : "Visit coach"}</Text>
            </Pressable>
          ) : null}
          {ageBand ? <Text style={styles.meta}>{AGE_LABEL[ageBand] ?? ageBand}</Text> : null}
        </View>
      </View>
      {gallery.length > 0 ? (
        <View style={styles.gallery}>
          {gallery.map((photo) => (
            <Image key={photo.id} source={{ uri: photo.url }} style={styles.galleryImage} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function labelGoal(goal: string | undefined): string {
  if (goal === "PLAY_MORE") return "Play more";
  if (goal === "LEARN") return "Learn";
  if (goal === "WATCH") return "Watch";
  return "No goal yet";
}

function confirmDelete(token: string | null, signOut: () => Promise<void>) {
  const run = () => void removeAccount(token, signOut);
  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    if (window.confirm("Delete this account? Your videos will be removed.")) run();
    return;
  }
  Alert.alert("Delete account", "Your videos will be removed.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: run },
  ]);
}

async function removeAccount(token: string | null, signOut: () => Promise<void>) {
  if (!token) return;
  await api("/v1/me", { method: "DELETE", token });
  await signOut();
  router.replace("/login");
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, padding: 20, paddingTop: 64, gap: 16, paddingBottom: 110 },
  cardBlock: { gap: 14, backgroundColor: colors.card, borderRadius: 24, padding: 14 },
  cover: { width: "100%", height: 168, borderRadius: 18, backgroundColor: "#101010" },
  header: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#101010" },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  galleryImage: { width: 96, height: 96, borderRadius: 16, backgroundColor: "#101010" },
  link: { color: colors.ink, backgroundColor: colors.accent, fontSize: 14, fontWeight: "800", marginTop: 6, alignSelf: "flex-start", overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  avatarText: { color: colors.ink, fontSize: 28, fontWeight: "800" },
  identity: { flex: 1, gap: 3 },
  title: { color: colors.text, fontSize: 26, fontWeight: "800", letterSpacing: -0.4 },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 19 },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 18, padding: 14, gap: 2 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: "800" },
  heading: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 8, letterSpacing: -0.4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  choiceOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceText: { color: colors.text },
  choiceTextOn: { color: "#111", fontWeight: "700" },
  subhead: { color: colors.text, fontSize: 15, fontWeight: "600", marginTop: 8 },
  card: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: colors.card, borderRadius: 18, padding: 12 },
  cardOn: { borderWidth: 1, borderColor: colors.accent },
  thumb: { width: 64, height: 84, borderRadius: 12, backgroundColor: "#101010" },
  cardBody: { flex: 1, gap: 3 },
  caption: { color: colors.text, fontSize: 16, fontWeight: "700" },
  pill: { color: colors.muted, fontSize: 11, fontWeight: "800", borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pillLive: { color: colors.ink, backgroundColor: colors.accent, borderColor: colors.accent },
  panel: { backgroundColor: "#12160c", borderRadius: 20, padding: 16, gap: 8 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { color: colors.muted, width: 52, fontSize: 12 },
  track: { flex: 1, height: 8, backgroundColor: "#222", borderRadius: 99, overflow: "hidden" },
  bar: { height: 8, backgroundColor: colors.accent, borderRadius: 99, minWidth: 0 },
  barAlt: { backgroundColor: "#9ad0ff" },
  barValue: { color: colors.text, width: 28, textAlign: "right", fontSize: 12 },
  error: { color: colors.danger, fontSize: 14 },
});
