import { AppShell } from "@/components/AppShell";
import { EventTable } from "@/components/EventTable";
import { StatusPill } from "@/components/StatusPill";
import { events } from "@/data/horizon";
import { allTasks, balanceOutstanding, blockers, eventProfit, formatDate, money } from "@/lib/workflow";

export default function DashboardPage() {
  const activeEvents = events.filter((event) => !event.archived);
  const tasks = allTasks(activeEvents);
  const openTasks = tasks.filter((task) => task.status !== "Done");
  const overdueTasks = openTasks.filter((task) => task.dueDate && new Date(`${task.dueDate}T00:00:00`) < new Date("2026-08-30T00:00:00"));
  const bookedEvents = activeEvents.filter((event) => ["Booked", "Planning", "Ready"].includes(event.stage));
  const revenue = activeEvents.reduce((sum, event) => sum + event.finance.quotedAmount, 0);
  const outstanding = activeEvents.reduce((sum, event) => sum + balanceOutstanding(event), 0);
  const profit = activeEvents.reduce((sum, event) => sum + eventProfit(event), 0);

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <h1>Operations Dashboard</h1>
          <p>General business snapshot, with the action work separated onto its own page.</p>
        </div>
        <StatusPill tone="info">Local v0.5</StatusPill>
      </header>

      <section className="grid grid-4">
        <div className="metric">
          <span>Active events</span>
          <strong>{activeEvents.length}</strong>
        </div>
        <div className="metric">
          <span>Booked / planning</span>
          <strong>{bookedEvents.length}</strong>
        </div>
        <div className="metric">
          <span>Open actions</span>
          <strong>{openTasks.length}</strong>
        </div>
        <div className="metric">
          <span>Overdue actions</span>
          <strong>{overdueTasks.length}</strong>
        </div>
      </section>

      <section className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="metric">
          <span>Quoted revenue</span>
          <strong>{money(revenue)}</strong>
        </div>
        <div className="metric">
          <span>Outstanding balance</span>
          <strong>{money(outstanding)}</strong>
        </div>
        <div className="metric">
          <span>Estimated profit</span>
          <strong>{money(profit)}</strong>
        </div>
      </section>

      <section className="section" style={{ marginTop: 18 }}>
        <div className="section-head">
          <h2>Pipeline</h2>
          <StatusPill tone="neutral">{activeEvents.length} current</StatusPill>
        </div>
        <div className="grid grid-3">
          {["New", "Quote Sent", "Booked", "Planning", "Completed"].map((stage) => (
            <div className="field" key={stage}>
              <label>{stage}</label>
              <strong>{activeEvents.filter((event) => event.stage === stage).length}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ marginTop: 18 }}>
        <div className="section-head">
          <h2>Upcoming Events</h2>
          <StatusPill tone="info">{formatDate(activeEvents[0]?.eventDate)}</StatusPill>
        </div>
        <EventTable events={activeEvents.slice().sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""))} />
      </section>

      <section className="section" style={{ marginTop: 18 }}>
        <div className="section-head">
          <h2>Current Weak Spots</h2>
        </div>
        <div className="grid grid-3">
          <div className="note">Deposit invoice sent and deposit received are now treated as formal checkpoints.</div>
          <div className="note">Setlist sorted is due 6 weeks before event.</div>
          <div className="note">Musicians sorted is due 3 months before event.</div>
        </div>
      </section>
    </AppShell>
  );
}
