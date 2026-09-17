"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/Workspace";
import { Field, Check, Section, errorMessage } from "@/components/Controls";
import type { Settings } from "@/lib/model";
const weekLabels = {
  internalWeeks: "Internal Organisation starts",
  musiciansWeeks: "Organise musicians",
  repertoireWeeks: "Resolve repertoire",
  arrangementsWeeks: "Complete arrangements",
  rehearsalWeeks: "Organise rehearsals",
  finalWeeks: "Final Details starts",
  finalCheckWeeks: "Final pre-event confirmation",
  paymentWeeks: "Client balance due",
} as const;
export default function Page() {
  const { data, saveSettings, demo } = useWorkspace();
  const [draft, setDraft] = useState<Settings>({ ...data.settings });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await saveSettings(draft);
      setDraft({ ...draft, revision: draft.revision + 1 });
      setNotice("Settings saved. All generated deadlines now use these rules.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function backup() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            version: 1,
            mode: demo ? "demo" : "live",
            ...data,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `horizon-${demo ? "demo-" : ""}backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">WORKFLOW & TIMING</span>
          <h1>Make the process yours.</h1>
          <p>
            These rules calculate due dates from the event date. Manual action
            dates stay as entered.
          </p>
        </div>
      </header>
      <form onSubmit={save}>
        {!draft.defaultsReviewed && (
          <p className="notice">
            The starting timings below are proposed defaults. Review them once
            before using this workspace for live events.
          </p>
        )}
        <Section id="weeks" title="Weeks before the event">
          <div className="field-grid">
            {Object.entries(weekLabels).map(([key, label]) => (
              <Field
                key={key}
                label={`${label} (weeks)`}
                type="number"
                min={0}
                max={104}
                value={draft[key as keyof typeof weekLabels]}
                onChange={(v) => setDraft({ ...draft, [key]: Number(v) })}
              />
            ))}
          </div>
        </Section>
        <Section id="communications" title="Other due dates">
          <div className="field-grid">
            <Field
              label="Enquiry / booking follow-up (days)"
              type="number"
              min={0}
              max={30}
              value={draft.responseDays}
              onChange={(v) => setDraft({ ...draft, responseDays: Number(v) })}
            />
            <Field
              label="Deposit check after welcome email (days)"
              type="number"
              min={0}
              max={90}
              value={draft.depositFollowupDays}
              onChange={(v) =>
                setDraft({ ...draft, depositFollowupDays: Number(v) })
              }
            />
            <Field
              label="Post-event actions (days after event)"
              type="number"
              min={0}
              max={90}
              value={draft.postEventDays}
              onChange={(v) => setDraft({ ...draft, postEventDays: Number(v) })}
            />
          </div>
        </Section>
        <Section id="readiness" title="Event Ready">
          <p>
            Requires resolved event details, no deferred fields, every required
            musician confirmed with music and any required contract, approved
            repertoire, final event confirmation, and completed pre-event
            actions.
          </p>
          <Check
            label="Also require the client balance to be paid"
            checked={draft.readyRequiresPayment}
            onChange={(v) => setDraft({ ...draft, readyRequiresPayment: v })}
          />
          <Check
            label="We have reviewed these workflow defaults"
            checked={draft.defaultsReviewed}
            onChange={(v) => setDraft({ ...draft, defaultsReviewed: v })}
          />
        </Section>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="success" role="status">
            {notice}
          </p>
        )}
        <button disabled={busy}>
          {busy ? "Saving…" : "Save timing rules"}
        </button>
      </form>
      <Section id="backup" title="Data export">
        <p>
          Download the workspace records as JSON for a manual backup. Store
          exports privately. Database backups remain the primary recovery
          method.
        </p>
        <button className="secondary" onClick={backup}>
          Download {demo ? "demo " : ""}backup
        </button>
      </Section>
    </>
  );
}
