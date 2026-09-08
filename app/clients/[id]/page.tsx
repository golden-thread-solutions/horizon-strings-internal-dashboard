import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { events, processRules } from "@/data/horizon";
import {
  balanceOutstanding,
  blockers,
  checkpointStatus,
  formatDate,
  missingFields,
  money,
  nextAction
} from "@/lib/workflow";

export default async function ClientEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = events.find((item) => item.id === id);
  if (!event) notFound();

  const eventBlockers = blockers(event);
  const missing = missingFields(event);
  const checkpoints = checkpointStatus(event);

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <h1>{event.clientName}</h1>
          <p>
            {event.id} · {event.eventType} · {formatDate(event.eventDate)} · {event.sheetName}
          </p>
        </div>
        <StatusPill tone={eventBlockers.length ? "bad" : "good"}>{eventBlockers.length ? "Needs attention" : "Clear"}</StatusPill>
      </header>

      <div className="tabs">
        {["Main details", "Contacts", "Timing", "Location", "Repertoire", "Musicians", "Finance", "Logistics", "Client contact"].map((tab) => (
          <span className="tab" key={tab}>{tab}</span>
        ))}
      </div>

      <div className="layout-two">
        <div className="stack">
          <section className="section">
            <div className="section-head">
              <h2>Main Details</h2>
              <StatusPill tone="info">{event.stage}</StatusPill>
            </div>
            <div className="field-grid">
              <div className="field"><label>Event date</label><strong>{formatDate(event.eventDate)}</strong></div>
              <div className="field"><label>Playing time</label><strong>{event.mainDetails.playingMinutes ? `${event.mainDetails.playingMinutes} min` : "TBD"}</strong></div>
              <div className="field"><label>Ensemble</label><strong>{event.mainDetails.ensemble ?? "TBD"}</strong></div>
              <div className="field"><label>Day</label><strong>{event.mainDetails.day ?? "TBD"}</strong></div>
              <div className="field"><label>Next action</label><strong>{nextAction(event)}</strong></div>
              <div className="field"><label>Source</label><strong>{event.source}</strong></div>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><h2>Contacts</h2></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Role</th><th>Name</th><th>Phone</th><th>Email</th><th>Notes</th></tr></thead>
                <tbody>
                  {event.contacts.map((contact) => (
                    <tr key={contact.role}>
                      <td>{contact.role}</td>
                      <td>{contact.name || "TBD"}</td>
                      <td>{contact.phone || "TBD"}</td>
                      <td>{contact.email || "TBD"}</td>
                      <td>{contact.notes || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><h2>Timing & Location</h2></div>
            <div className="field-grid">
              <div className="field"><label>Arrival</label><strong>{event.timings.arrivalTime ?? "TBD"}</strong></div>
              <div className="field"><label>Play start</label><strong>{event.timings.playStart ?? event.timings.ceremonyStart ?? "TBD"}</strong></div>
              <div className="field"><label>Area</label><strong>{event.location.area ?? "TBD"}</strong></div>
              <div className="field"><label>Address</label><strong>{event.location.address ?? "TBD"}</strong></div>
              <div className="field"><label>Wet weather</label><strong>{event.location.wetWeatherArea ?? "TBD"}</strong></div>
              <div className="field"><label>Shelter</label><strong>{event.logistics.Shelter || "TBD"}</strong></div>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><h2>Repertoire / Setlist</h2><StatusPill tone="warn">Due 6 weeks before</StatusPill></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Moment</th><th>Piece</th><th>Status</th><th>Notes</th></tr></thead>
                <tbody>
                  {event.repertoire.map((piece) => (
                    <tr key={piece.moment}>
                      <td>{piece.moment}</td>
                      <td>{piece.piece || "TBD"}</td>
                      <td><StatusPill tone={piece.status === "Needs arranging" ? "bad" : piece.status === "Approved" ? "good" : "neutral"}>{piece.status}</StatusPill></td>
                      <td>{piece.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><h2>Musicians</h2><StatusPill tone="warn">Due 3 months before</StatusPill></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Instrument</th><th>Confirmed</th><th>Music sent</th><th>Signed</th><th>Paid</th></tr></thead>
                <tbody>
                  {event.musicians.map((musician) => (
                    <tr key={`${musician.name}-${musician.instrument}`}>
                      <td>{musician.name}</td>
                      <td>{musician.instrument}</td>
                      <td>{musician.confirmed ? "Yes" : "No"}</td>
                      <td>{musician.musicSent ? "Yes" : "No"}</td>
                      <td>{musician.signed ? "Yes" : "No"}</td>
                      <td>{musician.paid ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {!event.musicians.length && <tr><td colSpan={6}>No musicians listed yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="stack">
          <section className="section">
            <div className="section-head"><h2>Checkpoints</h2></div>
            <div className="checklist">
              {checkpoints.map((checkpoint) => (
                <div className="check-row" key={checkpoint.label}>
                  <span className={`check-dot ${checkpoint.done ? "done" : ""}`}>{checkpoint.done ? "✓" : "!"}</span>
                  <div>
                    <strong>{checkpoint.label}</strong>
                    <small>{checkpoint.detail}</small>
                  </div>
                  <small>{formatDate(checkpoint.dueDate)}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-head"><h2>Finance</h2></div>
            <div className="stack">
              <div className="field"><label>Quoted</label><strong>{money(event.finance.quotedAmount)}</strong></div>
              <div className="field"><label>Deposit</label><strong>{money(event.finance.depositReceived)} / {money(event.finance.depositRequired)}</strong></div>
              <div className="field"><label>Balance outstanding</label><strong>{money(balanceOutstanding(event))}</strong></div>
            </div>
          </section>

          <section className="section">
            <div className="section-head"><h2>Blockers</h2></div>
            <div className="stack">
              {eventBlockers.map((blocker) => <div className="note" key={blocker}>{blocker}</div>)}
              {!eventBlockers.length && <div className="note">No blockers detected.</div>}
            </div>
          </section>

          <section className="section">
            <div className="section-head"><h2>Missing Info</h2></div>
            <div className="stack">
              {missing.map((item) => <div className="field" key={item}><strong>{item}</strong></div>)}
              {!missing.length && <div className="field"><strong>Nothing obvious missing.</strong></div>}
            </div>
          </section>

          <section className="section">
            <div className="section-head"><h2>Rules</h2></div>
            <div className="stack">
              {processRules.slice(0, 5).map((rule) => <small key={rule}>{rule}</small>)}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
