import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { processRules, workflowSettings } from "@/data/horizon";

export default function SettingsPage() {
  return (
    <AppShell>
      <header className="page-head">
        <div>
          <h1>Settings & Workflow</h1>
          <p>Readable v0.5 rules. These are not yet editable in-app because we should prove the model first.</p>
        </div>
        <StatusPill tone="neutral">Read-only</StatusPill>
      </header>
      <section className="section">
        <div className="section-head"><h2>Workflow Settings</h2></div>
        <div className="grid grid-3">
          <div className="field">
            <label>Default deposit</label>
            <strong>${workflowSettings.defaultDepositAmount}</strong>
          </div>
          <div className="field">
            <label>Musicians sorted due</label>
            <strong>{workflowSettings.musiciansSortedDaysBeforeEvent} days before event</strong>
          </div>
          <div className="field">
            <label>Setlist sorted due</label>
            <strong>{workflowSettings.setlistSortedDaysBeforeEvent} days before event</strong>
          </div>
          <div className="field">
            <label>Final invoice target</label>
            <strong>{workflowSettings.finalInvoiceLeadDays} days before event</strong>
          </div>
          <div className="field">
            <label>Review request target</label>
            <strong>{workflowSettings.reviewRequestDaysAfterEvent} days after event</strong>
          </div>
        </div>
      </section>
      <section className="section" style={{ marginTop: 18 }}>
        <div className="section-head"><h2>Current Business Rules</h2></div>
        <div className="stack">
          {processRules.map((rule) => <div className="field" key={rule}><strong>{rule}</strong></div>)}
        </div>
      </section>
      <section className="section" style={{ marginTop: 18 }}>
        <div className="section-head"><h2>Deferred</h2></div>
        <div className="grid grid-3">
          <div className="note">Supabase database and login.</div>
          <div className="note">Configurable workflow builder.</div>
          <div className="note">Gmail, Calendar, accounting, and payment integrations.</div>
        </div>
      </section>
    </AppShell>
  );
}
