"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "./Workspace";
import { errorMessage } from "./Controls";
import { newEvent } from "@/lib/model";
import { boardCards, boardStages } from "@/lib/board";
import { businessToday, formatDate, money } from "@/lib/workflow";

export function EventBoard() {
  const { data, saveEvent } = useWorkspace();
  const router = useRouter();
  const [today, setToday] = useState(businessToday());
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("All active records");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setToday(businessToday()), 60000);
    return () => clearInterval(timer);
  }, []);
  const cards = boardCards(data, today).filter(
    (c) =>
      `${c.name} ${c.area} ${c.code}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (scope === "All active records" ||
        (scope === "Enquiries"
          ? boardStages.indexOf(c.stage as (typeof boardStages)[number]) < 3
          : boardStages.indexOf(c.stage as (typeof boardStages)[number]) >= 3)),
  );
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await saveEvent(newEvent(name, today));
      dialog.current?.close();
      router.push(`/clients/${saved.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-head board-page-head">
        <div>
          <span className="eyebrow">THE EVENT REGISTER</span>
          <h1>Events & enquiries</h1>
        </div>
        <button
          onClick={() => {
            setName("");
            setError("");
            dialog.current?.showModal();
          }}
        >
          ＋ New enquiry
        </button>
      </header>
      <div className="toolbar board-toolbar">
        <label className="search-label">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, event ID or area"
          />
        </label>
        <label>
          Show
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option>All active records</option>
            <option>Enquiries</option>
            <option>Booked events</option>
          </select>
        </label>
        <span className="muted">
          {cards.length} {cards.length === 1 ? "record" : "records"}
        </span>
        <Link className="board-archive-link" href="/archive">
          Archived events
        </Link>
        <Link href="/trash">Trash</Link>
      </div>
      <div
        className="event-board"
        role="region"
        aria-label="Active events and enquiries Kanban"
        tabIndex={0}
      >
        {boardStages.map((stage, i) => {
          const items = cards.filter((c) => c.stage === stage);
          return (
            <section
              key={stage}
              className={`board-column board-column-${i}`}
              aria-labelledby={`stage-${i}`}
            >
              <header className="board-column-head">
                <h2 id={`stage-${i}`}>{stage}</h2>
                <span
                  className="board-count"
                  aria-label={`${items.length} records`}
                >
                  {items.length}
                </span>
              </header>
              <div className="board-column-cards">
                {items.map((c) => (
                  <Link
                    key={`${c.kind}:${c.id}`}
                    href={c.href}
                    className="board-card"
                  >
                    <span className="board-card-date">
                      {c.date ? formatDate(c.date) : "Date TBC"}
                    </span>
                    <strong className="board-card-name">{c.name}</strong>
                    <span className="board-card-area">
                      {c.area || "Area TBC"}
                    </span>
                    <span className="board-card-value">
                      {c.value === null ? "Value TBC" : money(c.value)}
                    </span>
                  </Link>
                ))}
                {!items.length && (
                  <p className="board-empty">
                    No{" "}
                    {search || scope !== "All active records"
                      ? "matching "
                      : ""}
                    records
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <dialog
        ref={dialog}
        className="workspace-dialog"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <form onSubmit={create}>
          <h2>New enquiry</h2>
          <label>
            Name
            <input
              autoFocus
              required
              maxLength={300}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="muted">
            A name is enough to start. Add other details when you know them.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="row-actions">
            <button disabled={busy}>
              {busy ? "Creating…" : "Create enquiry"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
