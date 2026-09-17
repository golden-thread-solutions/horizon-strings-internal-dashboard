"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { browserSupabase } from "@/lib/supabase";
import { demoData } from "@/lib/demo";
import {
  eventSchema,
  settingsSchema,
  musicianSchema,
  pieceSchema,
  type Dataset,
  type EventRecord,
  type Settings,
  type Musician,
  type Piece,
} from "@/lib/model";

type WorkspaceValue = {
  data: Dataset;
  demo: boolean;
  refreshId: number;
  refresh: () => Promise<void>;
  saveEvent: (e: EventRecord) => Promise<EventRecord>;
  saveSettings: (s: Settings) => Promise<void>;
  saveMusician: (m: Musician) => Promise<void>;
  savePiece: (p: Piece) => Promise<void>;
};
const Context = createContext<WorkspaceValue | null>(null);
const storageKey = "horizon-dashboard-demo-v1";
const navigation = [
  ["/", "Dashboard"],
  ["/clients", "Events & enquiries"],
  ["/tasks", "All actions"],
  ["/musicians", "Musicians"],
  ["/repertoire", "Repertoire & arrangements"],
  ["/finance", "Finance"],
  ["/settings", "Settings"],
];
function validateData(value: Dataset): Dataset {
  return {
    events: value.events.map((e) => eventSchema.parse(e)),
    settings: settingsSchema.parse(value.settings),
    musicians: value.musicians.map((m) => musicianSchema.parse(m)),
    pieces: value.pieces.map((p) => pieceSchema.parse(p)),
  };
}
export function useWorkspace() {
  const v = useContext(Context);
  if (!v) throw new Error("Workspace unavailable");
  return v;
}

export function Workspace({
  children,
  demo,
  configured,
}: {
  children: ReactNode;
  demo: boolean;
  configured: boolean;
}) {
  const pathname = usePathname();
  const [data, setData] = useState<Dataset | null>(null);
  const [ready, setReady] = useState(false);
  const [refreshId, setRefreshId] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function request(operation?: string, value?: unknown) {
    const db = browserSupabase();
    const session = await db?.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) throw new Error("Your session expired. Sign in again.");
    const res = await fetch("/api/workspace", {
      method: operation ? "POST" : "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(operation
        ? { body: JSON.stringify({ operation, data: value }) }
        : {}),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Unable to save. Please retry.");
    return body;
  }
  async function refresh() {
    setError("");
    try {
      if (demo) {
        const saved = localStorage.getItem(storageKey);
        const next = saved ? validateData(JSON.parse(saved)) : demoData();
        if (!saved) localStorage.setItem(storageKey, JSON.stringify(next));
        setData(next);
      } else setData(validateData(await request()));
      setRefreshId((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load data");
      throw e;
    }
  }
  useEffect(() => {
    if (demo) {
      refresh()
        .catch(() => {})
        .finally(() => setReady(true));
      return;
    }
    const db = browserSupabase();
    if (!db) {
      setReady(true);
      return;
    }
    let active = true;
    db.auth.getSession().then(({ data: auth }) => {
      if (!active) return;
      setSignedIn(!!auth.session);
      if (auth.session)
        refresh()
          .catch(() => {})
          .finally(() => setReady(true));
      else setReady(true);
    });
    const { data: listener } = db.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setSignedIn(false);
        setData(null);
      }
      if (event === "SIGNED_IN" && session) {
        setSignedIn(true);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
    // Initialisation only. Explicit refresh never replaces an unsaved event automatically.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const db = browserSupabase();
      if (!db) throw new Error("Supabase is not configured");
      const result = await db.auth.signInWithPassword({ email, password });
      if (result.error)
        throw new Error("Sign-in failed. Check your email and password.");
      setPassword("");
      setSignedIn(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }
  async function saveEvent(event: EventRecord) {
    const valid = eventSchema.parse(event);
    let saved: EventRecord;
    if (demo) {
      const latest = validateData(
        JSON.parse(localStorage.getItem(storageKey) || "null"),
      );
      const current = latest.events.find((e) => e.id === valid.id);
      if ((current?.revision || 0) !== valid.revision)
        throw new Error(
          "This event changed in another tab. Reload before saving.",
        );
      saved = {
        ...valid,
        revision: valid.revision + 1,
        code:
          current?.code ||
          `DEMO-${String(latest.events.length + 1).padStart(3, "0")}`,
      };
      const next = {
        ...latest,
        events: current
          ? latest.events.map((e) => (e.id === saved.id ? saved : e))
          : [saved, ...latest.events],
      };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setData(next);
    } else {
      saved = eventSchema.parse(await request("event", valid));
      setData((current) =>
        current
          ? {
              ...current,
              events: current.events.some((e) => e.id === saved.id)
                ? current.events.map((e) => (e.id === saved.id ? saved : e))
                : [saved, ...current.events],
            }
          : current,
      );
    }
    return saved;
  }
  async function saveSettings(settings: Settings) {
    const valid = settingsSchema.parse(settings);
    if (demo) {
      const latest = validateData(
        JSON.parse(localStorage.getItem(storageKey) || "null"),
      );
      if (latest.settings.revision !== valid.revision)
        throw new Error(
          "Settings changed in another tab. Reload before saving.",
        );
      const next = {
        ...latest,
        settings: { ...valid, revision: valid.revision + 1 },
      };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setData(next);
    } else {
      const saved = settingsSchema.parse(await request("settings", valid));
      setData((d) => (d ? { ...d, settings: saved } : d));
    }
  }
  async function saveCatalogue(
    kind: "musician" | "piece",
    item: Musician | Piece,
  ) {
    const valid =
      kind === "musician"
        ? musicianSchema.parse(item)
        : pieceSchema.parse(item);
    const saved = demo ? valid : await request(kind, valid);
    const key = kind === "musician" ? "musicians" : "pieces";
    const current = demo
      ? validateData(JSON.parse(localStorage.getItem(storageKey) || "null"))
      : data!;
    const items = current[key] as (Musician | Piece)[];
    const next = {
      ...current,
      [key]: items.some((x) => x.id === saved.id)
        ? items.map((x) => (x.id === saved.id ? saved : x))
        : [...items, saved],
    };
    if (demo) localStorage.setItem(storageKey, JSON.stringify(next));
    setData(next as Dataset);
  }
  const signout = async () => {
    await browserSupabase()?.auth.signOut();
    setData(null);
    setSignedIn(false);
    setError("");
  };
  if (!ready)
    return (
      <main className="login">
        <h1>Horizon Strings</h1>
        <p>Opening your workspace…</p>
      </main>
    );
  if (!configured && !demo)
    return (
      <main className="login">
        <span className="eyebrow">HORIZON STRINGS · OPERATIONS</span>
        <h1>Private workspace</h1>
        <p>
          The dashboard is waiting for its Supabase connection. No business
          records are available until setup is complete.
        </p>
        <p>
          Follow the launch checklist to connect the database and owner
          accounts.
        </p>
      </main>
    );
  if (!demo && !signedIn)
    return (
      <main className="login">
        <span className="eyebrow">HORIZON STRINGS · OPERATIONS</span>
        <h1>Welcome back.</h1>
        <p>Sign in with your owner account.</p>
        <form onSubmit={login}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </form>
        <p className="muted">
          Owner accounts are created privately. There is no public registration.
        </p>
      </main>
    );
  if (!data)
    return (
      <main className="login">
        <h1>Workspace unavailable</h1>
        <p role="alert" className="error">
          {error}
        </p>
        <button onClick={() => refresh().catch(() => {})}>Retry</button>
        {!demo && (
          <button className="secondary" onClick={signout}>
            Sign out
          </button>
        )}
      </main>
    );
  return (
    <Context.Provider
      value={{
        data,
        demo,
        refreshId,
        refresh,
        saveEvent,
        saveSettings,
        saveMusician: (m) => saveCatalogue("musician", m),
        savePiece: (p) => saveCatalogue("piece", p),
      }}
    >
      <div className="shell">
        <aside className="sidebar">
          <Link href="/" className="brand">
            <span className="brand-monogram">HS</span>
            <span>
              Horizon Strings<small>OPERATIONS</small>
            </span>
          </Link>
          <nav>
            {navigation.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={
                  (href === "/" ? pathname === "/" : pathname.startsWith(href))
                    ? "page"
                    : undefined
                }
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <span>
              {demo ? "Local demonstration" : "Private owner workspace"}
            </span>
            {!demo && (
              <button className="text-button" onClick={signout}>
                Sign out
              </button>
            )}
          </div>
        </aside>
        <div className="workspace">
          {demo && (
            <div className="demo-banner">
              DEMO · Synthetic records saved in this browser only. Do not enter
              real client data.
            </div>
          )}
          <main className="main">
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {children}
          </main>
        </div>
      </div>
    </Context.Provider>
  );
}
