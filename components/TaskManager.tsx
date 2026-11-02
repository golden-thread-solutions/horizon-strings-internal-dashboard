"use client";
import Link from "next/link";
import { assignedPerson } from "@/lib/people";
import { useRef, useState } from "react";
import { useWorkspace } from "./Workspace";
import { PersonSelect } from "./PersonSelect";
import { Field, Check, Select, errorMessage, Notes } from "./Controls";
import { type GeneralTask, taskSchema } from "@/lib/model";
import { businessToday, formatDate } from "@/lib/workflow";
export function TaskManager() {
  const { data, saveGeneralTask, saveEvent, refresh } = useWorkspace();
  const [draft, setDraft] = useState<GeneralTask | null>(null),
    [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  function open(task?: GeneralTask) {
    setError("");
    setEventId("");
    setDraft(
      task
        ? { ...task }
        : {
            id: crypto.randomUUID(),
            revision: 0,
            title: "",
            kind: "Task",
            dueDate: businessToday(),
            assignee: "",
            recipient: "",
            notes: "",
            done: false,
            completedAt: "",
          },
    );
    dialog.current?.showModal();
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !draft) return;
    setBusy(true);
    setError("");
    try {
      if (eventId) {
        const event = data.events.find(
          (e) => e.id === eventId && !e.archived && !e.deletedAt,
        );
        if (!event) throw new Error("Choose an active event.");
        await saveEvent({
          ...event,
          tasks: [...event.tasks, taskSchema.parse(draft)],
        });
      } else await saveGeneralTask(draft);
      dialog.current?.close();
      setDraft(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const people = data.people || [];
  return (
    <section className="section" id="business-tasks">
      <div className="section-heading">
        <div>
          <h2>General business tasks</h2>
          <p className="muted">
            Work that is not linked to an event. Event tasks are edited in their
            event workspace.
          </p>
        </div>
        <button onClick={() => open()}>Add task</button>
      </div>
      <button
        type="button"
        className="text-button"
        onClick={() => refresh().catch((e) => setError(errorMessage(e)))}
      >
        Reload saved tasks
      </button>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Due</th>
              <th>Assignee</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data.generalTasks || []).map((t) => (
              <tr id={`general-${t.id}`} key={t.id}>
                <td>
                  <button className="text-button" onClick={() => open(t)}>
                    {t.title}
                  </button>
                </td>
                <td>{formatDate(t.dueDate)}</td>
                <td>
                  {assignedPerson(people, t.assignee)?.name ||
                    t.assignee ||
                    "Unassigned"}
                </td>
                <td>{t.done ? "Completed" : "Open"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.generalTasks?.length && (
          <p className="empty">No general business tasks yet.</p>
        )}
      </div>
      {error && !draft && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <dialog
        ref={dialog}
        className="workspace-dialog"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setDraft(null);
        }}
      >
        {draft && (
          <form onSubmit={save}>
            <h2>{draft.revision ? "Edit task" : "Add task"}</h2>
            {!draft.revision && (
              <label>
                Link to
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                >
                  <option value="">General business task</option>
                  {data.events
                    .filter((e) => !e.archived && !e.deletedAt)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <Field
              label="Task title"
              required
              value={draft.title}
              onChange={(title) => setDraft({ ...draft, title })}
            />
            <Select
              label="Kind"
              value={draft.kind}
              options={["Task", "Communication"]}
              onChange={(kind) =>
                setDraft({ ...draft, kind: kind as GeneralTask["kind"] })
              }
            />
            <Field
              label="Due date"
              type="date"
              required
              value={draft.dueDate}
              onChange={(dueDate) => setDraft({ ...draft, dueDate })}
            />
            <PersonSelect
              value={draft.assignee}
              onChange={(assignee) => setDraft({ ...draft, assignee })}
            />
            {draft.kind === "Communication" && (
              <Field
                label="Recipient"
                value={draft.recipient}
                onChange={(recipient) => setDraft({ ...draft, recipient })}
              />
            )}
            <Notes
              label="Task notes"
              value={draft.notes}
              onChange={(notes) => setDraft({ ...draft, notes })}
            />
            <Check
              label="Completed"
              checked={draft.done}
              onChange={(done) =>
                setDraft({
                  ...draft,
                  done,
                  completedAt: done ? businessToday() : "",
                })
              }
            />
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="row-actions">
              <button disabled={busy}>{busy ? "Saving…" : "Save task"}</button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  dialog.current?.close();
                  setDraft(null);
                }}
              >
                Cancel
              </button>
            </div>
            <p className="muted">
              Saving a communication records an action; it does not send a
              message. <Link href="/settings#people">Manage people</Link>
            </p>
          </form>
        )}
      </dialog>
    </section>
  );
}
