"use client";
import Link from "next/link";
import { assignedPerson } from "@/lib/people";
import { useEffect, useState } from "react";
import { useWorkspace } from "./Workspace";
import {
  eventActions,
  businessToday,
  formatDate,
  urgency,
  addDays,
  type Action,
} from "@/lib/workflow";
export function ActionTable({
  actions,
  today,
}: {
  actions: Action[];
  today: string;
}) {
  const { data } = useWorkspace();
  return actions.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Due</th>
            <th>Action</th>
            <th>Event</th>
            <th>Owner / recipient</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((a) => (
            <tr key={a.id}>
              <td>
                <span
                  className={`urgency ${urgency(a.dueDate, today).toLowerCase().replace(" ", "-")}`}
                >
                  {urgency(a.dueDate, today)}
                </span>
                <small>{formatDate(a.dueDate)}</small>
              </td>
              <td>
                <Link
                  href={
                    a.eventId
                      ? `/clients/${a.eventId}#${a.section}`
                      : `/tasks#${a.section}`
                  }
                >
                  {a.title}
                </Link>
              </td>
              <td>{a.eventName}</td>
              <td>
                {assignedPerson(data.people || [], a.assignee)?.name ||
                  a.assignee ||
                  "Unassigned"}
                {a.recipient && <small>To: {a.recipient}</small>}
              </td>
              <td className="muted">{a.origin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="empty">Nothing due in this view.</p>
  );
}
export function ActionQueue({ all = false }: { all?: boolean }) {
  const { data } = useWorkspace();
  const [scope, setScope] = useState(all ? "All dates" : "Next 7 days");
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [today, setToday] = useState(businessToday());
  useEffect(() => {
    const timer = setInterval(() => setToday(businessToday()), 60000);
    return () => clearInterval(timer);
  }, []);
  const actions: Action[] = [
    ...data.events.flatMap((e) => eventActions(e, data.settings, today)),
    ...(data.generalTasks || [])
      .filter((t) => !t.done)
      .map((t) => ({
        ...t,
        eventId: "",
        eventName: "General business",
        section: `general-${t.id}`,
        origin: "Manual" as const,
      })),
  ];
  const visible = actions
    .filter(
      (a) =>
        (scope === "All dates" ||
          a.dueDate <= addDays(today, scope === "Today / overdue" ? 0 : 7)) &&
        `${a.title} ${a.eventName} ${a.assignee} ${assignedPerson(data.people || [], a.assignee)?.name || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (assignee === "all" ||
          a.assignee === assignee ||
          assignedPerson(data.people || [], a.assignee)?.id === assignee),
    )
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        a.eventName.localeCompare(b.eventName),
    );
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">
            {formatDate(today)} · AUSTRALIA / SYDNEY
          </span>
          <h1>{all ? "All actions" : "What needs attention."}</h1>
          <p>
            Work owed by Horizon, ordered by due date. Open an action to work on
            its event or task.
          </p>
        </div>
        <Link className="button" href="/">
          New enquiry
        </Link>
      </header>
      <div className="toolbar">
        <label>
          Assignee
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="all">All people</option>
            <option value="">Unassigned</option>
            {(data.people || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="search-label">
          Find an action
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search event, action or owner"
          />
        </label>
        <label>
          Due
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option>Today / overdue</option>
            <option>Next 7 days</option>
            <option>All dates</option>
          </select>
        </label>
        <span className="muted">{visible.length} open actions</span>
      </div>
      {(["Task", "Communication"] as const).map((kind) => (
        <section className="section" key={kind}>
          <div className="section-heading">
            <h2>
              {kind === "Task" ? "Pending tasks" : "Pending communications"}
            </h2>
            <span>{visible.filter((a) => a.kind === kind).length}</span>
          </div>
          <ActionTable
            actions={visible.filter((a) => a.kind === kind)}
            today={today}
          />
        </section>
      ))}
    </>
  );
}
