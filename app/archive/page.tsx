"use client";
import Link from "next/link";
import { useWorkspace } from "@/components/Workspace";
import { formatDate } from "@/lib/workflow";
export default function Page() {
  const { data } = useWorkspace();
  const events = data.events
    .filter((e) => e.archived && !e.deletedAt)
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  return (
    <>
      <header className="page-head">
        <div>
          <Link href="/" className="back-link">
            ← Events & enquiries
          </Link>
          <h1>Archived events</h1>
          <p>Closed records are kept here, off the active board.</p>
        </div>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Date / area</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/clients/${e.id}`}>{e.name}</Link>
                </td>
                <td>
                  {formatDate(e.eventDate)}
                  <small>{e.area}</small>
                </td>
                <td>{e.archiveReason || "Completed"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!events.length && <p className="empty">No archived events.</p>}
      </div>
    </>
  );
}
