"use client";
import Link from "next/link";
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
                <Link href={`/clients/${a.eventId}#${a.section}`}>
                  {a.title}
                </Link>
              </td>
              <td>{a.eventName}</td>
              <td>
                {a.assignee || "Either owner"}
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
  const [today, setToday] = useState(businessToday());
  useEffect(() => {
    const timer = setInterval(() => setToday(businessToday()), 60000);
    return () => clearInterval(timer);
  }, []);
  const actions = data.events
    .flatMap((e) => eventActions(e, data.settings, today))
    .filter(
      (a) =>
        (scope === "All dates" ||
          a.dueDate <= addDays(today, scope === "Today / overdue" ? 0 : 7)) &&
        `${a.title} ${a.eventName} ${a.assignee}`
          .toLowerCase()
          .includes(search.toLowerCase()),
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
            its event.
          </p>
        </div>
        <Link className="button" href="/clients#new">
          New enquiry
        </Link>
      </header>
      <div className="toolbar">
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
        <span className="muted">{actions.length} open actions</span>
      </div>
      {(["Task", "Communication"] as const).map((kind) => (
        <section className="section" key={kind}>
          <div className="section-heading">
            <h2>
              {kind === "Task" ? "Pending tasks" : "Pending communications"}
            </h2>
            <span>{actions.filter((a) => a.kind === kind).length}</span>
          </div>
          <ActionTable
            actions={actions.filter((a) => a.kind === kind)}
            today={today}
          />
        </section>
      ))}
    </>
  );
}
