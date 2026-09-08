import Link from "next/link";
import { EventRecord } from "@/data/horizon";
import { balanceOutstanding, blockers, formatDate, nextAction } from "@/lib/workflow";
import { StatusPill } from "@/components/StatusPill";

export function EventTable({ events }: { events: EventRecord[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Date</th>
            <th>Type</th>
            <th>Stage</th>
            <th>Next action</th>
            <th>Blockers</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const eventBlockers = blockers(event);
            return (
              <tr key={event.id}>
                <td>
                  <Link href={`/clients/${event.id}`} className="table-link">
                    {event.clientName}
                  </Link>
                  <small>{event.id}</small>
                </td>
                <td>{formatDate(event.eventDate)}</td>
                <td>{event.eventType}</td>
                <td>
                  <StatusPill tone={event.stage === "Ready" || event.stage === "Closed" ? "good" : "info"}>
                    {event.stage}
                  </StatusPill>
                </td>
                <td>{nextAction(event)}</td>
                <td>
                  {eventBlockers.length ? (
                    <StatusPill tone="bad">{eventBlockers.length}</StatusPill>
                  ) : (
                    <StatusPill tone="good">Clear</StatusPill>
                  )}
                </td>
                <td>${balanceOutstanding(event).toLocaleString("en-AU")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
