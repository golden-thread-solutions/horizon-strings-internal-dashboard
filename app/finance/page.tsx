"use client";
import Link from "next/link";
import { useWorkspace } from "@/components/Workspace";
import {
  balance,
  formatDate,
  money,
  profit,
  received,
  totalFee,
} from "@/lib/workflow";
export default function Page() {
  const { data } = useWorkspace();
  const events = data.events
    .filter((e) => !e.archived)
    .sort((a, b) =>
      (a.eventDate || "9999").localeCompare(b.eventDate || "9999"),
    );
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">EVENT FINANCES · AUD</span>
          <h1>Payments & costs</h1>
          <p>
            Open an event to record charges, deposits, payments and player fees.
          </p>
        </div>
      </header>
      <div className="finance-line">
        <span>
          Fees{" "}
          <strong>{money(events.reduce((s, e) => s + totalFee(e), 0))}</strong>
        </span>
        <span>
          Received{" "}
          <strong>{money(events.reduce((s, e) => s + received(e), 0))}</strong>
        </span>
        <span>
          Outstanding{" "}
          <strong>{money(events.reduce((s, e) => s + balance(e), 0))}</strong>
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Fee</th>
              <th>Deposit received</th>
              <th>Balance</th>
              <th>Player costs</th>
              <th>Est. profit</th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/clients/${e.id}#finance`}>{e.name}</Link>
                  <small>{formatDate(e.eventDate)}</small>
                </td>
                <td>{money(totalFee(e))}</td>
                <td>
                  {e.finance.depositReceived
                    ? money(e.finance.depositAmount)
                    : "Not received"}
                </td>
                <td className={balance(e) > 0 ? "attention" : ""}>
                  {money(balance(e))}
                  {received(e) > totalFee(e) && (
                    <small>Credit: {money(received(e) - totalFee(e))}</small>
                  )}
                </td>
                <td>{money(e.musicians.reduce((s, m) => s + m.fee, 0))}</td>
                <td>{money(profit(e))}</td>
                <td>
                  {e.finance.invoiceReference || "—"}
                  <small>
                    {e.finance.invoiceSent
                      ? "Final invoice sent"
                      : "Final invoice not sent"}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!events.length && <p className="empty">No active events yet.</p>}
      </div>
      <p className="muted">
        Estimated profit is fees less recorded player and other costs. This is
        operational tracking; tax and accounting are handled separately.
      </p>
    </>
  );
}
