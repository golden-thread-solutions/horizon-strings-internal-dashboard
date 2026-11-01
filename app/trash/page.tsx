"use client";
import Link from "next/link";
import { useState } from "react";
import { useWorkspace } from "@/components/Workspace";
import { errorMessage } from "@/components/Controls";
import { formatDate } from "@/lib/workflow";
import type { EventRecord } from "@/lib/model";
export default function Page() {
  const { data, setEventDeleted, refresh } = useWorkspace();
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function restore(e: EventRecord) {
    if (busy) return;
    setBusy(e.id);
    setError("");
    try {
      await setEventDeleted(e, false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  const events = data.events.filter((e) => e.deletedAt);
  return (
    <>
      <header className="page-head">
        <div>
          <Link className="back-link" href="/">
            ← Events & enquiries
          </Link>
          <h1>Trash</h1>
          <p>
            Deleted events stay out of the board and actions. Restore them here.
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => refresh().catch((e) => setError(errorMessage(e)))}
        >
          Reload saved data
        </button>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Event date</th>
              <th>Restore</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.name}
                  <small>{e.code}</small>
                </td>
                <td>{formatDate(e.eventDate)}</td>
                <td>
                  <button disabled={!!busy} onClick={() => restore(e)}>
                    {busy === e.id ? "Restoring…" : "Restore event"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!events.length && <p className="empty">Trash is empty.</p>}
      </div>
    </>
  );
}
