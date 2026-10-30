import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { api, Profile, ProfileInput, ProfileKind, ProfilePhotoRole, Taxonomy } from "../lib/api";
import { putFile } from "../lib/put-file";
import { Button, Chip, colors, ErrorText, Field } from "./ui";

const KINDS: { id: ProfileKind; label: string }[] = [
  { id: "PLAYER", label: "Player" },
  { id: "COACH", label: "Coach" },
  { id: "ACADEMY", label: "Academy" },
];

const GOALS: { id: Profile["goal"]; label: string }[] = [
  { id: "WATCH", label: "Watch" },
  { id: "LEARN", label: "Learn" },
  { id: "PLAY_MORE", label: "Play more" },
];

const FREQUENCIES: { id: Profile["playFrequency"]; label: string }[] = [
  { id: "WATCH_ONLY", label: "Mostly watch" },
  { id: "CASUAL", label: "Play sometimes" },
  { id: "WEEKLY", label: "Play weekly" },
  { id: "MOST_DAYS", label: "Play most days" },
  { id: "COMPETITIVE", label: "Play competitively" },
];

const AGE_GROUPS = [
  { id: "AGE_13_15", label: "13–15" },
  { id: "AGE_16_17", label: "16–17" },
  { id: "AGE_18_PLUS", label: "18+" },
];

const BATCHES = [
  { id: "MORNING", label: "Morning" },
  { id: "EVENING", label: "Evening" },
  { id: "WEEKEND", label: "Weekend" },
];

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProfileForm({
  token,
  taxonomy,
  profile,
  submitLabel,
  onSubmit,
  onChanged,
}: {
  token: string | null;
  taxonomy: Taxonomy | null;
  profile: Profile | null;
  submitLabel: string;
  onSubmit: (input: ProfileInput) => Promise<void>;
  onChanged?: () => Promise<void>;
}) {
  const [kind, setKind] = useState<ProfileKind>(profile?.kind ?? "PLAYER");
  const [sportId, setSportId] = useState<string | null>(profile?.sports.find((sport) => sport.relation === "FOLLOWS")?.sportId ?? null);
  const [levelId, setLevelId] = useState<string | null>(profile?.sports.find((sport) => sport.relation === "FOLLOWS")?.levelId ?? null);
  const [goal, setGoal] = useState<Profile["goal"]>(profile?.goal ?? "PLAY_MORE");
  const [city, setCity] = useState(profile?.city ?? "");
  const [area, setArea] = useState(profile?.area ?? "");
  const [cityVisible, setCityVisible] = useState(profile?.cityVisible ?? false);
  const [playFrequency, setPlayFrequency] = useState<Profile["playFrequency"]>(profile?.playFrequency ?? "WEEKLY");
  const [aboutPlay, setAboutPlay] = useState(profile?.aboutPlay ?? "");
  const [academyName, setAcademyName] = useState(profile?.academyName ?? "");
  const [linkUrl, setLinkUrl] = useState(profile?.linkUrl ?? "");
  const [groundName, setGroundName] = useState(profile?.groundName ?? "");
  const [establishedYear, setEstablishedYear] = useState(profile?.establishedYear ? String(profile.establishedYear) : "");
  const [trialNote, setTrialNote] = useState(profile?.trialNote ?? "");
  const [coachesWhat, setCoachesWhat] = useState(profile?.coachesWhat ?? "");
  const [qualification, setQualification] = useState(profile?.qualification ?? "");
  const [yearsCoaching, setYearsCoaching] = useState(profile?.yearsCoaching != null ? String(profile.yearsCoaching) : "");
  const [achievements, setAchievements] = useState(profile?.achievements ?? "");
  const [about, setAbout] = useState(profile?.about ?? "");
  const [ageGroups, setAgeGroups] = useState<string[]>(profile?.ageGroups ?? []);
  const [batches, setBatches] = useState<string[]>(profile?.batches ?? []);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(profile != null);

  useEffect(() => {
    if (!profile || seeded) return;
    setKind(profile.kind);
    setSportId(profile.sports.find((sport) => sport.relation === "FOLLOWS")?.sportId ?? null);
    setLevelId(profile.sports.find((sport) => sport.relation === "FOLLOWS")?.levelId ?? null);
    setGoal(profile.goal);
    setCity(profile.city ?? "");
    setArea(profile.area ?? "");
    setCityVisible(profile.cityVisible);
    setPlayFrequency(profile.playFrequency);
    setAboutPlay(profile.aboutPlay ?? "");
    setAcademyName(profile.academyName ?? "");
    setLinkUrl(profile.linkUrl ?? "");
    setGroundName(profile.groundName ?? "");
    setEstablishedYear(profile.establishedYear ? String(profile.establishedYear) : "");
    setTrialNote(profile.trialNote ?? "");
    setCoachesWhat(profile.coachesWhat ?? "");
    setQualification(profile.qualification ?? "");
    setYearsCoaching(profile.yearsCoaching != null ? String(profile.yearsCoaching) : "");
    setAchievements(profile.achievements ?? "");
    setAbout(profile.about ?? "");
    setAgeGroups(profile.ageGroups);
    setBatches(profile.batches);
    setSeeded(true);
  }, [profile, seeded]);

  async function submit() {
    if (!sportId) {
      setError("Pick a sport");
      return;
    }
    if (!city.trim()) {
      setError("Add your city");
      return;
    }
    if (kind === "ACADEMY" && !academyName.trim()) {
      setError("Add the academy name");
      return;
    }
    if (linkUrl.trim() && !/^https?:\/\//i.test(linkUrl.trim())) {
      setError("The link must start with http:// or https://");
      return;
    }
    const year = numberOrUndefined(establishedYear);
    const years = numberOrUndefined(yearsCoaching);
    if (kind === "ACADEMY" && establishedYear.trim() && year == null) {
      setError("Year started should be a year, like 2014");
      return;
    }
    if (kind === "COACH" && yearsCoaching.trim() && years == null) {
      setError("Years coaching should be a number");
      return;
    }
    const level = levelId ?? undefined;
    const sports: ProfileInput["sports"] = [{ sportId, relation: "FOLLOWS", levelId: level }];
    if (kind === "PLAYER" && playFrequency !== "WATCH_ONLY") sports.push({ sportId, relation: "PLAYS", levelId: level });
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await onSubmit({
        kind,
        city: city.trim(),
        area: area.trim(),
        cityVisible,
        goal: kind === "PLAYER" ? goal : "WATCH",
        playFrequency: kind === "PLAYER" ? playFrequency : "WATCH_ONLY",
        aboutPlay: kind === "PLAYER" ? aboutPlay.trim() : "",
        academyName: kind === "PLAYER" ? "" : academyName.trim(),
        linkUrl: kind === "PLAYER" ? "" : linkUrl.trim(),
        groundName: kind === "ACADEMY" ? groundName.trim() : "",
        establishedYear: kind === "ACADEMY" ? year : undefined,
        trialNote: kind === "ACADEMY" ? trialNote.trim() : "",
        coachesWhat: kind === "PLAYER" ? "" : coachesWhat.trim(),
        qualification: kind === "COACH" ? qualification.trim() : "",
        yearsCoaching: kind === "COACH" ? years : undefined,
        achievements: kind === "PLAYER" ? "" : achievements.trim(),
        about: kind === "PLAYER" ? "" : about.trim(),
        ageGroups: kind === "PLAYER" ? [] : ageGroups,
        batches: kind === "PLAYER" ? [] : batches,
        sports,
      });
      setNote("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(role: ProfilePhotoRole) {
    if (!token) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const contentType = asset.mimeType && IMAGE_TYPES.includes(asset.mimeType) ? asset.mimeType : "image/jpeg";
    setBusy(true);
    setError(null);
    let issued: { id: string; uploadUrl: string } | null = null;
    try {
      issued = await api<{ id: string; uploadUrl: string }>("/v1/me/profile/photos", {
        method: "POST",
        token,
        body: { role, contentType },
      });
      await putFile(asset.uri, issued.uploadUrl, contentType);
      await onChanged?.();
    } catch (err) {
      if (issued) await api(`/v1/me/profile/photos/${issued.id}`, { method: "DELETE", token }).catch(() => undefined);
      setError(err instanceof Error ? err.message : "Could not upload that picture");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(id: string) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/me/profile/photos/${id}`, { method: "DELETE", token });
      await onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that picture");
    } finally {
      setBusy(false);
    }
  }

  const teaching = kind !== "PLAYER";
  const photos = profile?.photos ?? [];
  const savedKind = profile?.kind;

  return (
    <View style={styles.form}>
      <Text style={styles.heading}>You are a</Text>
      <View style={styles.wrap}>
        {KINDS.map((item) => (
          <Chip key={item.id} label={item.label} active={kind === item.id} onPress={() => setKind(item.id)} />
        ))}
      </View>

      <Text style={styles.heading}>Sport</Text>
      <View style={styles.wrap}>
        {taxonomy?.sports.map((sport) => (
          <Chip key={sport.id} label={sport.name} active={sport.id === sportId} onPress={() => setSportId(sport.id)} />
        ))}
      </View>
      <Text style={styles.heading}>Level</Text>
      <View style={styles.wrap}>
        {taxonomy?.levels.map((level) => (
          <Chip key={level.id} label={level.name} active={level.id === levelId} onPress={() => setLevelId(level.id)} />
        ))}
      </View>

      <Text style={styles.heading}>Place</Text>
      <Field label="City" value={city} onChangeText={setCity} placeholder="Bengaluru" autoCapitalize="words" />
      <Field label="Area" value={area} onChangeText={setArea} placeholder="Indiranagar" autoCapitalize="words" />
      <Chip
        label={cityVisible ? "City is visible on your profile" : "Keep city private"}
        active={cityVisible}
        onPress={() => setCityVisible((current) => !current)}
      />

      {kind === "PLAYER" ? (
        <>
          <Text style={styles.heading}>How you play</Text>
          <View style={styles.wrap}>
            {GOALS.map((item) => (
              <Chip key={item.id} label={item.label} active={goal === item.id} onPress={() => setGoal(item.id)} />
            ))}
          </View>
          <View style={styles.wrap}>
            {FREQUENCIES.map((item) => (
              <Chip key={item.id} label={item.label} active={playFrequency === item.id} onPress={() => setPlayFrequency(item.id)} />
            ))}
          </View>
          <Field label="Sporting habit" value={aboutPlay} onChangeText={setAboutPlay} placeholder="Nets twice a week" autoCapitalize="sentences" />
        </>
      ) : null}

      {teaching ? (
        <>
          <Text style={styles.heading}>{kind === "ACADEMY" ? "Academy" : "Coaching"}</Text>
          <Field
            label={kind === "ACADEMY" ? "Academy name" : "Academy or club, if you coach there"}
            value={academyName}
            onChangeText={setAcademyName}
            placeholder="City Cricket Academy"
            autoCapitalize="words"
          />
          <Field
            label={kind === "ACADEMY" ? "Academy link" : "Coach link"}
            value={linkUrl}
            onChangeText={setLinkUrl}
            placeholder="https://"
            autoCapitalize="none"
          />
          <Text style={styles.heading}>Age groups</Text>
          <View style={styles.wrap}>
            {AGE_GROUPS.map((item) => (
              <Chip key={item.id} label={item.label} active={ageGroups.includes(item.id)} onPress={() => setAgeGroups((current) => toggle(current, item.id))} />
            ))}
          </View>
          <Text style={styles.heading}>Batch times</Text>
          <View style={styles.wrap}>
            {BATCHES.map((item) => (
              <Chip key={item.id} label={item.label} active={batches.includes(item.id)} onPress={() => setBatches((current) => toggle(current, item.id))} />
            ))}
          </View>
          <Field label="About" value={about} onChangeText={setAbout} placeholder="What a new player should know" autoCapitalize="sentences" />
          <Field label="What you coach" value={coachesWhat} onChangeText={setCoachesWhat} placeholder="Batting, footwork, match play" autoCapitalize="sentences" />
          <Field label="Achievements" value={achievements} onChangeText={setAchievements} placeholder="District runners-up, 2024" autoCapitalize="sentences" />
        </>
      ) : null}

      {kind === "COACH" ? (
        <>
          <Field label="Years coaching" value={yearsCoaching} onChangeText={setYearsCoaching} placeholder="8" autoCapitalize="none" />
          <Field label="Qualification" value={qualification} onChangeText={setQualification} placeholder="Level 2 coach" autoCapitalize="sentences" />
        </>
      ) : null}

      {kind === "ACADEMY" ? (
        <>
          <Field label="Ground or venue" value={groundName} onChangeText={setGroundName} placeholder="Cubbon Park nets" autoCapitalize="words" />
          <Field label="Year started" value={establishedYear} onChangeText={setEstablishedYear} placeholder="2014" autoCapitalize="none" />
          <Field label="Trials or joining" value={trialNote} onChangeText={setTrialNote} placeholder="Trials on the first Sunday" autoCapitalize="sentences" />
        </>
      ) : null}

      {profile && savedKind === kind && savedKind !== "PLAYER" ? (
        <PhotoSection kind={savedKind} photos={photos} busy={busy} onAdd={(role) => void addPhoto(role)} onRemove={(id) => void removePhoto(id)} />
      ) : null}
      {profile && savedKind !== kind ? <Text style={styles.note}>Save this profile before adding pictures.</Text> : null}

      {note ? <Text style={styles.note}>{note}</Text> : null}
      <ErrorText message={error} />
      <Button label={busy ? "Saving" : submitLabel} onPress={() => void submit()} disabled={busy} />
    </View>
  );
}

function PhotoSection({
  kind,
  photos,
  busy,
  onAdd,
  onRemove,
}: {
  kind: ProfileKind;
  photos: Profile["photos"];
  busy: boolean;
  onAdd: (role: ProfilePhotoRole) => void;
  onRemove: (id: string) => void;
}) {
  const gallery = photos.filter((photo) => photo.role === "GALLERY");
  const limit = kind === "ACADEMY" ? 8 : 4;
  return (
    <View style={styles.form}>
      <Text style={styles.heading}>Pictures</Text>
      {kind === "ACADEMY" ? <SinglePhoto label="Cover" role="COVER" photos={photos} onAdd={onAdd} onRemove={onRemove} /> : null}
      {kind === "ACADEMY" ? <SinglePhoto label="Logo" role="LOGO" photos={photos} onAdd={onAdd} onRemove={onRemove} /> : null}
      {kind === "COACH" ? <SinglePhoto label="Portrait" role="PORTRAIT" photos={photos} onAdd={onAdd} onRemove={onRemove} /> : null}
      <Text style={styles.note}>
        {kind === "ACADEMY" ? `Ground, nets, and session photos (${gallery.length}/${limit})` : `Session photos (${gallery.length}/${limit})`}
      </Text>
      <View style={styles.wrap}>
        {gallery.map((photo) => (
          <Pressable key={photo.id} onPress={() => onRemove(photo.id)} disabled={busy}>
            <Image source={{ uri: photo.url }} style={styles.thumb} />
          </Pressable>
        ))}
      </View>
      {gallery.length < limit ? <Button label="Add a photo" onPress={() => onAdd("GALLERY")} disabled={busy} /> : null}
      <Text style={styles.note}>Tap a photo to remove it.</Text>
    </View>
  );
}

function SinglePhoto({
  label,
  role,
  photos,
  onAdd,
  onRemove,
}: {
  label: string;
  role: ProfilePhotoRole;
  photos: Profile["photos"];
  onAdd: (role: ProfilePhotoRole) => void;
  onRemove: (id: string) => void;
}) {
  const photo = photos.find((item) => item.role === role);
  return (
    <View style={styles.form}>
      <Text style={styles.note}>{label}</Text>
      {photo ? (
        <Pressable onPress={() => onRemove(photo.id)}>
          <Image source={{ uri: photo.url }} style={role === "COVER" ? styles.cover : styles.thumb} />
        </Pressable>
      ) : (
        <Button label={`Add ${label.toLowerCase()}`} onPress={() => onAdd(role)} />
      )}
    </View>
  );
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function numberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : undefined;
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  heading: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 10, letterSpacing: -0.3 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  thumb: { width: 96, height: 96, borderRadius: 16, backgroundColor: "#101010" },
  cover: { width: "100%", height: 160, borderRadius: 20, backgroundColor: "#101010" },
});
