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
  const { data, saveEvent, convertWebsiteEnquiry } = useWorkspace();
  const router = useRouter();
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [archive, setArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [converting, setConverting] = useState("");
  const websiteEnquiries = [...data.websiteEnquiries].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
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
  async function convert(id: string) {
    setConverting(id);
    setError("");
    try {
      const event = await convertWebsiteEnquiry(id);
      router.push(`/clients/${event.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setConverting("");
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
      <section className="website-inbox" aria-labelledby="website-enquiries">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FROM THE PUBLIC WEBSITE</span>
            <h2 id="website-enquiries">Website enquiries</h2>
          </div>
          <span>
            {websiteEnquiries.filter((e) => e.dashboardStatus === "new").length}{" "}
            new
          </span>
        </div>
        {websiteEnquiries.length ? (
          <div className="table-wrap">
            <table className="website-enquiry-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Enquirer</th>
                  <th>Event</th>
                  <th>Message</th>
                  <th>Notification</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {websiteEnquiries.map((enquiry) => (
                  <tr key={enquiry.id}>
                    <td>
                      {new Date(enquiry.createdAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      <small>
                        {new Date(enquiry.createdAt).toLocaleTimeString(
                          "en-AU",
                          {
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}
                      </small>
                    </td>
                    <td>
                      <strong>{enquiry.name}</strong>
                      <small>
                        <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a>
                      </small>
                      {enquiry.phone && (
                        <small>
                          <a href={`tel:${enquiry.phone}`}>{enquiry.phone}</a>
                        </small>
                      )}
                      <small>Prefers {enquiry.preferredContact}</small>
                    </td>
                    <td>
                      {formatDate(enquiry.eventDate)}
                      <small>{enquiry.area || "Area not supplied"}</small>
                      <small>{enquiry.venue || "Venue not supplied"}</small>
                      {(enquiry.weddingPackage ||
                        enquiry.requestedEnsemble) && (
                        <small>
                          {[enquiry.weddingPackage, enquiry.requestedEnsemble]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      )}
                    </td>
                    <td className="enquiry-message">
                      {enquiry.message || "No message supplied"}
                    </td>
                    <td>
                      <span
                        className={
                          enquiry.emailStatus === "sent" ? "sent" : "attention"
                        }
                      >
                        {enquiry.emailStatus === "sent"
                          ? "Email sent"
                          : "Email needs attention"}
                      </span>
                    </td>
                    <td>
                      {enquiry.dashboardEventId ? (
                        <Link href={`/clients/${enquiry.dashboardEventId}`}>
                          Open event
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={!!converting}
                          onClick={() => convert(enquiry.id)}
                        >
                          {converting === enquiry.id
                            ? "Creating…"
                            : "Create event"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            New website enquiries will appear here automatically.
          </p>
        )}
      </section>
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
