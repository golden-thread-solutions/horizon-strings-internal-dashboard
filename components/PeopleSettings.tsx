"use client";
import { useState } from "react";
import { useWorkspace } from "./Workspace";
import { Check, Field, errorMessage, Section } from "./Controls";
import type { Person } from "@/lib/model";
export function PeopleSettings() {
  const { data, savePerson, refresh } = useWorkspace();
  const [draft, setDraft] = useState<Person | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !draft) return;
    setBusy(true);
    setError("");
    try {
      await savePerson(draft);
      setDraft(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section id="people" title="People">
      <p className="muted">
        People available for task assignment. This list does not give anyone
        login access. Inactive people keep their existing assignments.
      </p>
      <div className="toolbar">
        <button
          type="button"
          onClick={() => {
            setError("");
            setDraft({
              id: crypto.randomUUID(),
              revision: 0,
              name: "",
              active: true,
            });
          }}
        >
          Add person
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() => refresh().catch((e) => setError(errorMessage(e)))}
        >
          Reload people
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {draft && (
        <form className="inline-editor" onSubmit={save}>
          <Field
            label="Person name"
            value={draft.name}
            required
            onChange={(name) => setDraft({ ...draft, name })}
          />
          <Check
            label="Available for new tasks"
            checked={draft.active}
            onChange={(active) => setDraft({ ...draft, active })}
          />
          <div className="row-actions">
            <button disabled={busy}>{busy ? "Saving…" : "Save person"}</button>
            <button
              type="button"
              disabled={busy}
              className="secondary"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data.people || []).map((p) => (
              <tr key={p.id}>
                <td>
                  <button
                    className="text-button"
                    onClick={() => {
                      setError("");
                      setDraft({ ...p });
                    }}
                  >
                    {p.name}
                  </button>
                </td>
                <td>{p.active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
