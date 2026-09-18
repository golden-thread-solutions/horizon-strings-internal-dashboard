"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/Workspace";
import { newEvent } from "@/lib/model";
import {
  businessToday,
  deriveStage,
  eventActions,
  formatDate,
} from "@/lib/workflow";
import { errorMessage } from "@/components/Controls";
export default function Page() {
  const { data, saveEvent } = useWorkspace();
  const router = useRouter();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [archive, setArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const events = data.events
    .filter(
      (e) =>
        e.archived === archive &&
        `${e.name} ${e.code} ${e.area}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      (a.eventDate || "9999").localeCompare(b.eventDate || "9999"),
    );
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const event = await saveEvent(newEvent(name, businessToday()));
      router.push(`/clients/${event.id}`);
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
          <span className="eyebrow">THE EVENT REGISTER</span>
          <h1>Events & enquiries</h1>
          <p>
            One event, one workspace. Progress follows the facts you record.
          </p>
        </div>
      </header>
      <form id="new" className="intake toolbar" onSubmit={create}>
        <label>
          New enquiry name
          <input
            required
            maxLength={300}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name is all you need to start"
          />
        </label>
        <button disabled={busy}>{busy ? "Creating…" : "Create enquiry"}</button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
      <div className="toolbar">
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
          <select
            value={archive ? "Archived" : "Active"}
            onChange={(e) => setArchive(e.target.value === "Archived")}
          >
            <option>Active</option>
            <option>Archived</option>
          </select>
        </label>
        <span className="muted">{events.length} events</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Date / area</th>
              <th>Stage</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/clients/${e.id}`}>{e.name}</Link>
                  <small>
                    {e.code} · {e.eventType || "Type to be confirmed"}
                  </small>
                </td>
                <td>
                  {formatDate(e.eventDate)}
                  <small>{e.area || "Area to be confirmed"}</small>
                </td>
                <td>
                  <span className="stage">{deriveStage(e, data.settings)}</span>
                </td>
                <td>
                  {archive
                    ? e.archiveReason || "Completed"
                    : eventActions(e, data.settings)[0]?.title ||
                      "No open actions"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!events.length && <p className="empty">No events in this view.</p>}
      </div>
    </>
  );
}
