import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { events } from "@/data/horizon";
import { allTasks, formatDate, isOverdue } from "@/lib/workflow";

export default function TasksPage() {
  const tasks = allTasks(events);

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <h1>Tasks</h1>
          <p>Manual and generated tasks. v0.5 includes checkpoint tasks created from event reality.</p>
        </div>
        <StatusPill tone="neutral">{tasks.length} total</StatusPill>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Task</th><th>Event</th><th>Due</th><th>Status</th><th>Source</th><th>Priority</th></tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td><strong>{task.title}</strong><small>{task.notes}</small></td>
                <td>{task.eventId ? <Link className="table-link" href={`/clients/${task.eventId}`}>{task.eventName}</Link> : "General"}</td>
                <td>{formatDate(task.dueDate)}</td>
                <td><StatusPill tone={isOverdue(task) ? "bad" : "neutral"}>{task.status}</StatusPill></td>
                <td>{task.source}</td>
                <td>{task.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
