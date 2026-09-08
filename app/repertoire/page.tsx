import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { events } from "@/data/horizon";
import { formatDate } from "@/lib/workflow";

export default function RepertoirePage() {
  const requests = events.flatMap((event) =>
    event.repertoire.map((piece) => ({
      ...piece,
      eventId: event.id,
      clientName: event.clientName,
      eventDate: event.eventDate
    }))
  );
  const needsArranging = requests.filter((request) => request.status === "Needs arranging");

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <h1>Repertoire & Arrangements</h1>
          <p>Event song requests, setlist status, and arrangement work. Setlist sorted is due 6 weeks before event.</p>
        </div>
        <StatusPill tone={needsArranging.length ? "bad" : "good"}>{needsArranging.length} need arranging</StatusPill>
      </header>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Piece</th><th>Moment</th><th>Event</th><th>Date</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>
            {requests.map((request) => (
              <tr key={`${request.eventId}-${request.moment}-${request.piece}`}>
                <td>{request.piece || "TBD"}</td>
                <td>{request.moment}</td>
                <td><Link className="table-link" href={`/clients/${request.eventId}`}>{request.clientName}</Link></td>
                <td>{formatDate(request.eventDate)}</td>
                <td><StatusPill tone={request.status === "Needs arranging" ? "bad" : request.status === "Approved" ? "good" : "neutral"}>{request.status}</StatusPill></td>
                <td>{request.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
