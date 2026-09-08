import { AppShell } from "@/components/AppShell";
import { EventTable } from "@/components/EventTable";
import { StatusPill } from "@/components/StatusPill";
import { events } from "@/data/horizon";

export default function ClientsPage() {
  return (
    <AppShell>
      <header className="page-head">
        <div>
          <h1>Clients & Events</h1>
          <p>The spreadsheet-style index, but with stage, blockers, finance, and next action in one place.</p>
        </div>
        <StatusPill tone="neutral">{events.length} records</StatusPill>
      </header>
      <EventTable events={events} />
    </AppShell>
  );
}
