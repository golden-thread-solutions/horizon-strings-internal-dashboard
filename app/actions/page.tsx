import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { events } from "@/data/horizon";
import { allTasks, blockers, formatDate, isOverdue, nextAction } from "@/lib/workflow";

export default function ActionsPage() {
  const tasks = allTasks(events)
    .filter((task) => task.status !== "Done")
    .sort((a, b) => {
      if (isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
      return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
    });
  const blockedEvents = events.filter((event) => blockers(event).length > 0);

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <h1>Action Page</h1>
          <p>Everything that needs attention, separated from the general dashboard.</p>
        </div>
        <StatusPill tone="bad">{tasks.filter(isOverdue).length} overdue</StatusPill>
      </header>

      <div className="layout-two">
        <section className="section">
          <div className="section-head">
            <h2>Action Queue</h2>
            <StatusPill tone="neutral">{tasks.length} open</StatusPill>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Client</th>
                  <th>Due</th>
                  <th>Source</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <strong>{task.title}</strong>
                      <small>{task.notes}</small>
                    </td>
                    <td>
                      {task.eventId ? (
                        <Link href={`/clients/${task.eventId}`} className="table-link">
                          {task.eventName}
                        </Link>
                      ) : (
                        "General"
                      )}
                    </td>
                    <td>{formatDate(task.dueDate)}</td>
                    <td>{task.source}</td>
                    <td>
                      <StatusPill tone={task.priority === "High" ? "bad" : "warn"}>{task.priority}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="section">
          <div className="section-head">
            <h2>Blocked Events</h2>
            <StatusPill tone="bad">{blockedEvents.length}</StatusPill>
          </div>
          <div className="stack">
            {blockedEvents.map((event) => (
              <div className="field" key={event.id}>
                <label>{event.clientName}</label>
                <strong>{nextAction(event)}</strong>
                <small>{blockers(event).join(", ")}</small>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
