import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { events, musicians } from "@/data/horizon";
import { formatDate } from "@/lib/workflow";

export default function MusiciansPage() {
  const bookings = events.flatMap((event) =>
    event.musicians.map((musician) => ({
      ...musician,
      eventId: event.id,
      clientName: event.clientName,
      eventDate: event.eventDate
    }))
  );

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <h1>Musicians</h1>
          <p>Roster plus event-specific booking status. The key checkpoint is musicians sorted 3 months before event.</p>
        </div>
        <StatusPill tone="neutral">{musicians.length} known musicians</StatusPill>
      </header>

      <section className="section">
        <div className="section-head"><h2>Roster</h2></div>
        <div className="grid grid-3">
          {musicians.map((person) => (
            <div className="field" key={person.name}>
              <label>{person.instrument}</label>
              <strong>{person.name}</strong>
              <small>{person.notes}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ marginTop: 18 }}>
        <div className="section-head"><h2>Event Bookings</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Musician</th><th>Event</th><th>Date</th><th>Confirmed</th><th>Music sent</th><th>Signed</th><th>Paid</th></tr></thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={`${booking.eventId}-${booking.name}-${booking.instrument}`}>
                  <td><strong>{booking.name}</strong><small>{booking.instrument}</small></td>
                  <td><Link className="table-link" href={`/clients/${booking.eventId}`}>{booking.clientName}</Link></td>
                  <td>{formatDate(booking.eventDate)}</td>
                  <td>{booking.confirmed ? "Yes" : "No"}</td>
                  <td>{booking.musicSent ? "Yes" : "No"}</td>
                  <td>{booking.signed ? "Yes" : "No"}</td>
                  <td>{booking.paid ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
