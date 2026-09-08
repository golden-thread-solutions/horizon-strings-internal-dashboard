import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/StatusPill";
import { events } from "@/data/horizon";
import { balanceOutstanding, eventProfit, money } from "@/lib/workflow";

export default function FinancePage() {
  const revenue = events.reduce((sum, event) => sum + event.finance.quotedAmount, 0);
  const outstanding = events.reduce((sum, event) => sum + balanceOutstanding(event), 0);
  const profit = events.reduce((sum, event) => sum + eventProfit(event), 0);

  return (
    <AppShell>
      <header className="page-head">
        <div>
          <h1>Finance</h1>
          <p>Basic event-level finance only: quoted amount, deposit checkpoints, final payment, costs, and estimated profit.</p>
        </div>
        <StatusPill tone="info">No bank integration</StatusPill>
      </header>

      <section className="grid grid-3">
        <div className="metric"><span>Quoted revenue</span><strong>{money(revenue)}</strong></div>
        <div className="metric"><span>Outstanding</span><strong>{money(outstanding)}</strong></div>
        <div className="metric"><span>Estimated profit</span><strong>{money(profit)}</strong></div>
      </section>

      <section className="section" style={{ marginTop: 18 }}>
        <div className="section-head"><h2>Event Finance</h2></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Event</th><th>Quoted</th><th>Deposit invoice</th><th>Deposit received</th><th>Balance</th><th>Final invoice</th><th>Final paid</th><th>Profit</th></tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td><Link className="table-link" href={`/clients/${event.id}`}>{event.clientName}</Link><small>{event.id}</small></td>
                  <td>{money(event.finance.quotedAmount)}</td>
                  <td>{event.finance.depositInvoiceSent ? "Sent" : "Not sent"}</td>
                  <td>{money(event.finance.depositReceived)}</td>
                  <td>{money(balanceOutstanding(event))}</td>
                  <td>{event.finance.finalInvoiceSent ? "Sent" : "Not sent"}</td>
                  <td>{event.finance.finalPaid ? "Yes" : "No"}</td>
                  <td>{money(eventProfit(event))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
