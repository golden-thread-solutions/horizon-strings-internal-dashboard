"use client";
import Link from "next/link";
import { useState } from "react";
import { useWorkspace } from "./Workspace";
import { Field, Notes, errorMessage, Section } from "./Controls";
import type { Musician, Piece } from "@/lib/model";
import { formatDate, weeksBefore } from "@/lib/workflow";
export function MusicianCatalogue() {
  const { data, saveMusician } = useWorkspace();
  const empty = (): Musician => ({
    id: crypto.randomUUID(),
    name: "",
    instrument: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [draft, setDraft] = useState<Musician | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await saveMusician(draft!);
      setDraft(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">PEOPLE & BOOKINGS</span>
          <h1>Musicians</h1>
          <p>
            Your player directory and the events they are helping bring to life.
          </p>
        </div>
        <button
          onClick={() => {
            setDraft(empty());
            setError("");
          }}
        >
          Add musician
        </button>
      </header>
      {draft && (
        <form className="inline-editor" onSubmit={save}>
          <h2>
            {data.musicians.some((m) => m.id === draft.id)
              ? "Edit musician"
              : "New musician"}
          </h2>
          <div className="field-grid">
            <Field
              label="Musician name"
              required
              value={draft.name}
              onChange={(v) => setDraft({ ...draft, name: v })}
            />
            <Field
              label="Instrument"
              value={draft.instrument}
              onChange={(v) => setDraft({ ...draft, instrument: v })}
            />
            <Field
              label="Email"
              type="email"
              value={draft.email}
              onChange={(v) => setDraft({ ...draft, email: v })}
            />
            <Field
              label="Phone"
              value={draft.phone}
              onChange={(v) => setDraft({ ...draft, phone: v })}
            />
          </div>
          <Notes
            label="Notes"
            value={draft.notes}
            onChange={(v) => setDraft({ ...draft, notes: v })}
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="row-actions">
            <button disabled={busy}>Save musician</button>
            <button
              type="button"
              className="secondary"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <Section id="directory" title="Player directory">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Instrument</th>
                <th>Contact</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.musicians.map((m) => (
                <tr key={m.id}>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setDraft({ ...m });
                        setError("");
                      }}
                    >
                      {m.name}
                    </button>
                  </td>
                  <td>{m.instrument}</td>
                  <td>
                    {m.email}
                    <small>{m.phone}</small>
                  </td>
                  <td>{m.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.musicians.length && (
            <p className="empty">
              Add a musician once, then select them on any event.
            </p>
          )}
        </div>
      </Section>
      <Section id="bookings" title="Across upcoming events">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Player / role</th>
                <th>Confirmation</th>
                <th>Music</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {data.events
                .filter((e) => !e.archived)
                .flatMap((e) =>
                  e.musicians.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/clients/${e.id}#musicians`}>
                          {e.name}
                        </Link>
                        <small>{formatDate(e.eventDate)}</small>
                      </td>
                      <td>
                        {m.name || "Unassigned"}
                        <small>{m.instrument}</small>
                      </td>
                      <td>{m.confirmed ? "Confirmed" : "Pending"}</td>
                      <td>{m.musicSent ? "Provided" : "To send"}</td>
                      <td>{m.paid ? "Paid" : "Not paid"}</td>
                    </tr>
                  )),
                )}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
export function RepertoireCatalogue() {
  const { data, savePiece } = useWorkspace();
  const [draft, setDraft] = useState<Piece | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await savePiece(draft!);
      setDraft(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">MUSIC LIBRARY</span>
          <h1>Repertoire & arrangements</h1>
          <p>
            Keep the catalogue connected to event requests and outstanding music
            work.
          </p>
        </div>
        <button
          onClick={() => {
            setDraft({
              id: crypto.randomUUID(),
              title: "",
              artist: "",
              musicUrl: "",
              notes: "",
            });
            setError("");
          }}
        >
          Add repertoire piece
        </button>
      </header>
      {draft && (
        <form className="inline-editor" onSubmit={save}>
          <h2>Repertoire piece</h2>
          <div className="field-grid">
            <Field
              label="Title"
              required
              value={draft.title}
              onChange={(v) => setDraft({ ...draft, title: v })}
            />
            <Field
              label="Composer / artist"
              value={draft.artist}
              onChange={(v) => setDraft({ ...draft, artist: v })}
            />
            <Field
              label="Private music / Drive link"
              type="url"
              value={draft.musicUrl}
              onChange={(v) => setDraft({ ...draft, musicUrl: v })}
            />
          </div>
          <Notes
            label="Arrangement notes"
            value={draft.notes}
            onChange={(v) => setDraft({ ...draft, notes: v })}
          />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="row-actions">
            <button disabled={busy}>Save piece</button>
            <button
              type="button"
              className="secondary"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <Section id="arrangements" title="Pending arrangement work">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Piece</th>
                <th>Event</th>
                <th>Moment</th>
                <th>Due</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.events
                .filter((e) => !e.archived)
                .flatMap((e) =>
                  e.repertoire
                    .filter((p) => p.status === "Needs arranging")
                    .map((p) => (
                      <tr key={p.id}>
                        <td>{p.title || "Title to be confirmed"}</td>
                        <td>
                          <Link href={`/clients/${e.id}#repertoire`}>
                            {e.name}
                          </Link>
                        </td>
                        <td>{p.moment}</td>
                        <td>
                          {formatDate(
                            weeksBefore(e, data.settings.arrangementsWeeks),
                          )}
                        </td>
                        <td>{p.notes}</td>
                      </tr>
                    )),
                )}
            </tbody>
          </table>
        </div>
      </Section>
      <Section id="catalogue" title="Repertoire catalogue">
        <label className="search-label">
          Search repertoire
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Piece or composer"
          />
        </label>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Piece</th>
                <th>Composer / artist</th>
                <th>Music</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.pieces
                .filter((p) =>
                  `${p.title} ${p.artist}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => {
                          setDraft({ ...p });
                          setError("");
                        }}
                      >
                        {p.title}
                      </button>
                    </td>
                    <td>{p.artist}</td>
                    <td>
                      {p.musicUrl && (
                        <a href={p.musicUrl} target="_blank" rel="noreferrer">
                          Open music ↗
                        </a>
                      )}
                    </td>
                    <td>{p.notes}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!data.pieces.length && (
            <p className="empty">
              No repertoire added yet. Custom requests can be entered directly
              on an event.
            </p>
          )}
        </div>
      </Section>
    </>
  );
}
