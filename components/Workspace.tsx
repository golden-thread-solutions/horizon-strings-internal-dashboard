"use client";

import Link from "next/link";
import {
  WorkspaceNavigation,
  WorkspaceMotion,
  ThemeToggle,
} from "./WorkspaceMotion";
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
  newEvent,
  settingsSchema,
  musicianSchema,
  pieceSchema,
  websiteEnquirySchema,
  personSchema,
  generalTaskSchema,
  type Person,
  type GeneralTask,
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
  savePerson: (p: Person) => Promise<void>;
  saveGeneralTask: (t: GeneralTask) => Promise<void>;
  saveEvent: (e: EventRecord) => Promise<EventRecord>;
  setEventDeleted: (e: EventRecord, deleted: boolean) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  saveMusician: (m: Musician) => Promise<void>;
  savePiece: (p: Piece) => Promise<void>;
  convertWebsiteEnquiry: (id: string) => Promise<EventRecord>;
};
const Context = createContext<WorkspaceValue | null>(null);
const storageKey = "horizon-dashboard-demo-v1";
const navigation = [
  ["/", "Events & enquiries"],
  ["/tasks", "All actions"],
  ["/musicians", "Musicians"],
  ["/repertoire", "Repertoire & arrangements"],
  ["/finance", "Finance"],
  ["/settings", "Settings"],
];
function validateData(value: Dataset): Dataset {
  return {
    people: (value.people || []).map((p) => personSchema.parse(p)),
    generalTasks: (value.generalTasks || []).map((t) =>
      generalTaskSchema.parse(t),
    ),
    events: value.events.map((e) => eventSchema.parse(e)),
    settings: settingsSchema.parse(value.settings),
    musicians: value.musicians.map((m) => musicianSchema.parse(m)),
    pieces: value.pieces.map((p) => pieceSchema.parse(p)),
    websiteEnquiries: (value.websiteEnquiries || []).map((e) =>
      websiteEnquirySchema.parse(e),
    ),
  };
}
export function useWorkspace() {
  const v = useContext(Context);
  if (!v) throw new Error("Workspace unavailable");
  return v;
}

export function Workspace(props: {
  children: ReactNode;
  demo: boolean;
  configured: boolean;
}) {
  const pathname = usePathname();
  // Consent must not load the operational workspace or synchronise enquiries.
  if (pathname === "/oauth/consent") return <>{props.children}</>;
  return <BusinessWorkspace {...props} />;
}
function BusinessWorkspace({
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
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
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
    setNotice("");
    const valid = eventSchema.parse(event);
    let saved: EventRecord;
    if (demo) {
      const latest = validateData(
        JSON.parse(localStorage.getItem(storageKey) || "null"),
      );
      const current = latest.events.find((e) => e.id === valid.id);
      if (current?.deletedAt)
        throw new Error("Restore this event from Trash before editing.");
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
    setNotice("Event saved. Workflow and action dates updated.");
    return saved;
  }
  async function setEventDeleted(event: EventRecord, deleted: boolean) {
    setNotice("");
    let saved: EventRecord;
    if (demo) {
      const latest = validateData(
        JSON.parse(localStorage.getItem(storageKey) || "null"),
      );
      const current = latest.events.find((e) => e.id === event.id);
      if (
        !current ||
        current.revision !== event.revision ||
        Boolean(current.deletedAt) === deleted
      )
        throw new Error("Event changed. Reload before deleting or restoring.");
      saved = {
        ...current,
        revision: current.revision + 1,
        deletedAt: deleted ? new Date().toISOString() : "",
      };
      const next = {
        ...latest,
        events: latest.events.map((e) => (e.id === saved.id ? saved : e)),
      };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setData(next);
    } else {
      saved = eventSchema.parse(
        await request("eventTrash", {
          id: event.id,
          revision: event.revision,
          deleted,
        }),
      );
      setData((current) =>
        current
          ? {
              ...current,
              events: current.events.map((e) =>
                e.id === saved.id ? saved : e,
              ),
            }
          : current,
      );
    }
    setNotice(
      deleted
        ? "Event moved to Trash. You can restore it from Trash."
        : "Event restored.",
    );
  }
  async function saveSettings(settings: Settings) {
    setNotice("");
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
    setNotice("Settings saved. Generated deadlines updated.");
  }
  async function convertWebsiteEnquiry(id: string) {
    setNotice("");
    let saved: EventRecord;
    if (demo) {
      const latest = validateData(
        JSON.parse(localStorage.getItem(storageKey) || "null"),
      );
      const enquiry = latest.websiteEnquiries.find((e) => e.id === id);
      if (!enquiry) throw new Error("Website enquiry not found.");
      const existing = enquiry.dashboardEventId
        ? latest.events.find((e) => e.id === enquiry.dashboardEventId)
        : undefined;
      saved = existing || {
        ...newEvent(enquiry.name, enquiry.createdAt.slice(0, 10)),
        id: crypto.randomUUID(),
        eventDate: enquiry.eventDate,
        area: enquiry.area,
        address: enquiry.venue,
        source: "Website enquiry",
        notes: enquiry.message,
        contacts: [
          {
            id: crypto.randomUUID(),
            role: "Main contact",
            name: enquiry.name,
            email: enquiry.email,
            phone: enquiry.phone,
            notes: `Preferred reply: ${enquiry.preferredContact}`,
          },
        ],
      };
      if (!existing)
        saved = {
          ...saved,
          revision: 1,
          code: `DEMO-${String(latest.events.length + 1).padStart(3, "0")}`,
        };
      const next = {
        ...latest,
        events: existing ? latest.events : [saved, ...latest.events],
        websiteEnquiries: latest.websiteEnquiries.map((e) =>
          e.id === id
            ? {
                ...e,
                dashboardStatus: "converted" as const,
                dashboardEventId: saved.id,
              }
            : e,
        ),
      };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setData(next);
    } else {
      saved = eventSchema.parse(await request("convertEnquiry", { id }));
      await refresh();
    }
    setNotice("Enquiry added to the event board.");
    return saved;
  }
  async function saveWorkItem(
    kind: "person" | "generalTask",
    input: Person | GeneralTask,
  ) {
    setNotice("");
    const valid =
      kind === "person"
        ? personSchema.parse(input)
        : generalTaskSchema.parse(input);
    const key = kind === "person" ? "people" : "generalTasks";
    let saved: Person | GeneralTask;
    if (demo) {
      const latest = validateData(
        JSON.parse(localStorage.getItem(storageKey) || "null"),
      );
      const items = (latest[key] || []) as (Person | GeneralTask)[];
      const current = items.find((item) => item.id === valid.id);
      if ((current?.revision || 0) !== valid.revision)
        throw new Error("This record changed. Reload before saving.");
      if (
        kind === "person" &&
        (latest.people || []).some(
          (p) =>
            p.id !== valid.id &&
            p.name.toLowerCase() === (valid as Person).name.toLowerCase(),
        )
      )
        throw new Error("That person already exists.");
      saved = { ...valid, revision: valid.revision + 1 };
      const next = {
        ...latest,
        [key]: current
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [...items, saved],
      };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setData(next as Dataset);
    } else {
      const result = await request(kind, valid);
      saved =
        kind === "person"
          ? personSchema.parse(result)
          : generalTaskSchema.parse(result);
      setData((current) => {
        if (!current) return current;
        const items = (current[key] || []) as (Person | GeneralTask)[];
        return {
          ...current,
          [key]: items.some((item) => item.id === saved.id)
            ? items.map((item) => (item.id === saved.id ? saved : item))
            : [...items, saved],
        } as Dataset;
      });
    }
    setNotice(kind === "person" ? "Person saved." : "Task saved.");
  }
  async function saveCatalogue(
    kind: "musician" | "piece",
    item: Musician | Piece,
  ) {
    setNotice("");
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
    setNotice(
      kind === "musician" ? "Musician saved." : "Repertoire piece saved.",
    );
  }
  const signout = async () => {
    await browserSupabase()?.auth.signOut();
    setData(null);
    setSignedIn(false);
    setNotice("");
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
        savePerson: (p) => saveWorkItem("person", p),
        saveGeneralTask: (t) => saveWorkItem("generalTask", t),
        saveEvent,
        setEventDeleted,
        saveSettings,
        saveMusician: (m) => saveCatalogue("musician", m),
        savePiece: (p) => saveCatalogue("piece", p),
        convertWebsiteEnquiry,
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
          <WorkspaceNavigation items={navigation} />
          <div className="sidebar-bottom">
            <ThemeToggle />
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
            <div
              className="save-feedback"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {notice && (
                <div className="success save-feedback-message">
                  <span>{notice}</span>
                  <button
                    className="text-button"
                    onClick={() => setNotice("")}
                    aria-label="Dismiss save confirmation"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <WorkspaceMotion>{children}</WorkspaceMotion>
          </main>
        </div>
      </div>
    </Context.Provider>
  );
}
