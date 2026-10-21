import { FormEvent, useEffect, useState } from "react";
import { AdminPerson, AdminReport, AdminVideo, AuditRow, DecisionAction, api, Staff } from "./api";

const TOKEN_KEY = "sports.adminToken";
const STAFF_KEY = "sports.adminStaff";

type Tab = "videos" | "reports" | "people" | "log";

const ACTION_LABEL: Record<DecisionAction, string> = {
  APPROVE: "Publish",
  HOLD: "Hold",
  REMOVE: "Remove",
};

function storedStaff(): Staff | null {
  const raw = sessionStorage.getItem(STAFF_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Staff;
  } catch {
    return null;
  }
}

export function App() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [staff, setStaff] = useState<Staff | null>(storedStaff);

  function signIn(nextToken: string, nextStaff: Staff) {
    sessionStorage.setItem(TOKEN_KEY, nextToken);
    sessionStorage.setItem(STAFF_KEY, JSON.stringify(nextStaff));
    setToken(nextToken);
    setStaff(nextStaff);
  }

  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(STAFF_KEY);
    setToken(null);
    setStaff(null);
  }

  if (!token) return <Login onSuccess={signIn} />;
  return <Console token={token} staff={staff} onSignOut={signOut} />;
}

function Login({ onSuccess }: { onSuccess: (token: string, staff: Staff) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api<{ accessToken: string; user: Staff }>("/admin/auth/login", {
        body: { email: email.trim(), password },
      });
      onSuccess(session.accessToken, session.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <h1>Sports admin</h1>
        <p className="muted">Staff only. Review uploads, reports, and accounts.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={busy}>
          {busy ? "Signing in" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

function Console({ token, staff, onSignOut }: { token: string; staff: Staff | null; onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("videos");
  const [counts, setCounts] = useState({ videos: 0, needsReview: 0, reports: 0, people: 0 });
  const [error, setError] = useState<string | null>(null);

  async function refreshCounts() {
    const overview = await api<typeof counts>("/admin/overview", { token });
    setCounts(overview);
  }

  useEffect(() => {
    refreshCounts().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load admin"));
  }, [token]);

  return (
    <div className="shell">
      <header>
        <div className="who">
          <strong>{staff?.displayName ?? "Staff"}</strong>
          <span>{staff?.role ?? "Staff"}</span>
        </div>
        <nav>
          <TabButton current={tab} id="videos" label={`Videos ${counts.videos}`} onClick={setTab} />
          <TabButton current={tab} id="reports" label={`Reports ${counts.reports}`} onClick={setTab} />
          <TabButton current={tab} id="people" label={`People ${counts.people}`} onClick={setTab} />
          <TabButton current={tab} id="log" label="Decisions" onClick={setTab} />
        </nav>
        <button className="quiet" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </header>
      {error ? <p className="error empty">{error}</p> : null}
      {tab === "videos" ? <Videos token={token} onChange={() => void refreshCounts()} /> : null}
      {tab === "reports" ? <Reports token={token} /> : null}
      {tab === "people" ? <People token={token} onChange={() => void refreshCounts()} /> : null}
      {tab === "log" ? <Audit token={token} /> : null}
    </div>
  );
}

function TabButton({ current, id, label, onClick }: { current: Tab; id: Tab; label: string; onClick: (id: Tab) => void }) {
  return (
    <button type="button" className={current === id ? "" : "quiet"} onClick={() => onClick(id)}>
      {label}
    </button>
  );
}

function Videos({ token, onChange }: { token: string; onChange: () => void }) {
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "review">("all");
  const [error, setError] = useState<string | null>(null);
  const selected = videos.find((video) => video.id === selectedId) ?? null;
  const shown = videos.filter((video) => (filter === "all" ? true : ["UPLOADED", "CHECKING", "HELD"].includes(video.status)));

  async function load() {
    const response = await api<{ videos: AdminVideo[] }>("/admin/videos", { token });
    setVideos(response.videos);
    setError(null);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load videos"));
  }, [token]);

  return (
    <div className="workspace">
      <section className="list">
        <div className="toolbar">
          <button type="button" className={filter === "all" ? "" : "quiet"} onClick={() => setFilter("all")}>
            All uploads
          </button>
          <button type="button" className={filter === "review" ? "" : "quiet"} onClick={() => setFilter("review")}>
            Waiting
          </button>
        </div>
        {error ? <p className="error empty">{error}</p> : null}
        {shown.length === 0 ? <p className="empty">No videos in this list.</p> : null}
        {shown.map((video) => (
          <button key={video.id} type="button" className={video.id === selected?.id ? "case active" : "case"} onClick={() => setSelectedId(video.id)}>
            <span>{video.caption || "Untitled"}</span>
            <small>
              {video.status} · {video.creator.displayName}
            </small>
          </button>
        ))}
      </section>
      {selected ? (
        <VideoDetail
          video={selected}
          token={token}
          onDone={() => {
            setSelectedId(null);
            void load();
            onChange();
          }}
        />
      ) : (
        <p className="empty">Select an upload to watch it and publish, hold, or remove it.</p>
      )}
    </div>
  );
}

function VideoDetail({ video, token, onDone }: { video: AdminVideo; token: string; onDone: () => void }) {
  const [action, setAction] = useState<DecisionAction | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const playback = video.assets.find((asset) => (asset.role === "PROGRESSIVE" || asset.role === "PREVIEW") && httpUrl(asset.url));
  const poster = video.assets.find((asset) => asset.role === "THUMB_LG" || asset.role === "THUMB_SM");
  const actions = actionsFor(video.status);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!action) {
      setError("Choose publish, hold, or remove");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/videos/${video.id}/decision`, { token, body: { action, reason: reason.trim() } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the decision");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="detail">
      <div className="player">
        {playback ? <video src={playback.url} poster={httpUrl(poster?.url)} controls playsInline /> : <p className="empty">No preview file yet.</p>}
      </div>
      <h1>{video.caption || "Untitled"}</h1>
      <div className="meta">
        <span className="pill">{video.status}</span>
        <span className="pill">{video.sportId.replace("sport.", "")}</span>
        <span className="pill">{Math.round(video.durationMs / 1000)}s</span>
        <span className="pill">{video.creator.displayName}</span>
        <span className="pill">{video.creator.ageBand.replace("AGE_", "").replace("_PLUS", "+").replace("_", "–")}</span>
        <span className="pill">{video.counts.likes} likes</span>
        <span className="pill">{video.reports} reports</span>
      </div>
      {actions.length === 0 ? <p className="muted">This upload is not ready for a decision.</p> : null}
      {actions.length > 0 ? (
        <form className="card" onSubmit={submit}>
          <div className="actions">
            {actions.map((choice) => (
              <button
                key={choice}
                type="button"
                className={choice === "REMOVE" ? "danger" : choice === action ? "" : "quiet"}
                aria-pressed={choice === action}
                onClick={() => setAction(choice)}
              >
                {ACTION_LABEL[choice]}
              </button>
            ))}
          </div>
          <label>
            Reason
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} required rows={3} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={busy || !action}>
            {busy ? "Saving" : "Save"}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function Reports({ token }: { token: string }) {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ reports: AdminReport[] }>("/admin/reports", { token })
      .then((response) => setReports(response.reports))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load reports"));
  }, [token]);
  if (error) return <p className="error empty">{error}</p>;
  if (reports.length === 0) return <p className="empty">No reports.</p>;
  return (
    <ul className="reports page">
      {reports.map((report) => (
        <li key={report.id}>
          <strong>{report.video?.caption || "Video removed"}</strong>
          <div>{report.reason}</div>
          <small>{report.video?.status ?? "unknown"}</small>
        </li>
      ))}
    </ul>
  );
}

function People({ token, onChange }: { token: string; onChange: () => void }) {
  const [people, setPeople] = useState<AdminPerson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("Account review");

  async function load() {
    const response = await api<{ users: AdminPerson[] }>("/admin/users", { token });
    setPeople(response.users);
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load people"));
  }, [token]);

  async function setStatus(person: AdminPerson) {
    const status = person.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    await api(`/admin/users/${person.id}/status`, { token, body: { status, reason } });
    await load();
    onChange();
  }

  if (error) return <p className="error empty">{error}</p>;
  return (
    <div className="page">
      <label>
        Reason for the next account change
        <input value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Age</th>
            <th>Role</th>
            <th>Status</th>
            <th>Videos</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id}>
              <td>{person.displayName}</td>
              <td>{person.email}</td>
              <td>{person.ageBand.replace("AGE_", "").replace("_PLUS", "+").replace("_", "–")}</td>
              <td>{person.role}</td>
              <td>{person.status}</td>
              <td>{person.videos}</td>
              <td>
                {person.role === "USER" ? (
                  <button type="button" className="quiet" onClick={() => void setStatus(person)}>
                    {person.status === "SUSPENDED" ? "Restore" : "Suspend"}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Audit({ token }: { token: string }) {
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ entries: AuditRow[] }>("/admin/audit", { token })
      .then((response) => setEntries(response.entries))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load decisions"));
  }, [token]);
  if (error) return <p className="error empty">{error}</p>;
  if (entries.length === 0) return <p className="empty">No decisions yet.</p>;
  return (
    <ul className="reports page">
      {entries.map((entry) => (
        <li key={entry.id}>
          <strong>
            {entry.actor} · {entry.action}
          </strong>
          <div>{entry.reason}</div>
        </li>
      ))}
    </ul>
  );
}

function actionsFor(status: string): DecisionAction[] {
  if (status === "LIVE") return ["HOLD", "REMOVE"];
  if (status === "REJECTED") return ["REMOVE"];
  if (status === "REMOVED" || status === "DRAFT" || status === "UPLOADING") return [];
  return ["APPROVE", "HOLD", "REMOVE"];
}

function httpUrl(url: string | undefined): string | undefined {
  if (!url || url.startsWith("memory://")) return undefined;
  return url;
}
