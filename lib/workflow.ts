import {
  detailKeys,
  detailLabels,
  type EventRecord,
  type Settings,
  type DetailKey,
} from "./model";

export function businessToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const weeksBefore = (e: EventRecord, weeks: number) =>
  e.eventDate ? addDays(e.eventDate, -7 * weeks) : e.createdDate;
export const money = (v: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    v,
  );
export const formatDate = (v: string) =>
  v
    ? new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Australia/Sydney",
      }).format(new Date(`${v}T12:00:00Z`))
    : "Date to be confirmed";
export const totalFee = (e: EventRecord) =>
  e.finance.performance +
  e.finance.travel +
  e.finance.arrangements +
  e.finance.otherCharges;
export const received = (e: EventRecord) =>
  (e.finance.depositReceived ? e.finance.depositAmount : 0) +
  e.finance.finalReceived;
export const balance = (e: EventRecord) =>
  Math.max(0, Math.round((totalFee(e) - received(e)) * 100) / 100);
export const profit = (e: EventRecord) =>
  totalFee(e) -
  e.musicians.reduce((sum, m) => sum + m.fee, 0) -
  e.finance.otherCosts;
export const playerCount = (ensemble: EventRecord["ensemble"]) =>
  ({ "": 0, Solo: 1, Duo: 2, Trio: 3, Quartet: 4, Quintet: 5, Sextet: 6 })[
    ensemble
  ];
export function deferredDate(e: EventRecord, k: DetailKey, s: Settings) {
  const d = e.details[k];
  return (
    d.dueDate ||
    (e.eventDate && d.trigger
      ? weeksBefore(
          e,
          d.trigger === "Final Details" ? s.finalWeeks : s.internalWeeks,
        )
      : "")
  );
}
export function missingDetails(e: EventRecord) {
  const missing: string[] = [];
  if (!e.eventDate) missing.push("Event date");
  if (!e.ensemble) missing.push("Ensemble");
  if (!e.durationMinutes) missing.push("Playing duration");
  if (!e.area.trim()) missing.push("Area");
  if (!e.address.trim()) missing.push("Address");
  if (
    !e.contacts.some(
      (c) =>
        c.role === "Main contact" &&
        c.name.trim() &&
        (c.phone.trim() || c.email.trim()),
    )
  )
    missing.push("Main contact with phone or email");
  for (const key of detailKeys)
    if (e.details[key].state === "Unknown") missing.push(detailLabels[key]);
  return missing;
}
export function readiness(e: EventRecord, s: Settings) {
  const blockers = missingDetails(e);
  for (const k of detailKeys)
    if (e.details[k].state === "Deferred")
      blockers.push(`${detailLabels[k]} is deferred`);
  if (!musiciansReady(e))
    blockers.push("Confirm every required musician and their music / contract");
  if (!repertoireReady(e))
    blockers.push("Approve the setlist and finish arrangements");
  if (!e.milestones.finalConfirmed)
    blockers.push("Record the final event confirmation");
  if (s.readyRequiresPayment && balance(e) > 0)
    blockers.push("Outstanding client payment");
  if (
    e.tasks.some((t) => !t.done && (!e.eventDate || t.dueDate <= e.eventDate))
  )
    blockers.push("Complete outstanding pre-event actions");
  return blockers;
}
export function musiciansReady(e: EventRecord) {
  return (
    playerCount(e.ensemble) > 0 &&
    e.musicians.length >= playerCount(e.ensemble) &&
    e.musicians.every(
      (m) =>
        m.name.trim() &&
        m.instrument.trim() &&
        m.confirmed &&
        m.musicSent &&
        (!m.contractRequired || m.signed),
    )
  );
}
export function repertoireReady(e: EventRecord) {
  return (
    (e.details.repertoireBrief.state === "Not Applicable" &&
      e.repertoire.length === 0) ||
    (e.repertoire.length > 0 &&
      e.repertoire.every(
        (r) =>
          r.status === "Not Applicable" ||
          (r.title.trim() && r.status === "Approved"),
      ))
  );
}
export function deriveStage(
  e: EventRecord,
  s: Settings,
  today = businessToday(),
) {
  if (!e.finance.depositReceived)
    return e.milestones.welcomeSent
      ? "Pending Booking"
      : e.milestones.responded
        ? "Pending Enquiry"
        : "New Enquiry";
  if (e.eventDate && today > e.eventDate) return "Post-event";
  if (e.eventDate === today) return "Event Day";
  if (missingDetails(e).length) return "Details Pending";
  if (today < weeksBefore(e, s.internalWeeks)) return "Details Pending";
  if (today >= weeksBefore(e, s.finalWeeks))
    return readiness(e, s).length ? "Final Details" : "Event Ready";
  return "Internal Organisation";
}
export type Action = {
  id: string;
  eventId: string;
  eventName: string;
  title: string;
  kind: "Task" | "Communication";
  dueDate: string;
  section: string;
  origin: "Generated" | "Manual";
  assignee: string;
  recipient: string;
};
export function eventActions(
  e: EventRecord,
  s: Settings,
  today = businessToday(),
): Action[] {
  if (e.archived) return [];
  const actions: Action[] = [];
  const add = (
    key: string,
    title: string,
    dueDate: string,
    section: string,
    kind: Action["kind"] = "Task",
  ) =>
    actions.push({
      id: `${e.id}:${key}`,
      eventId: e.id,
      eventName: e.name,
      title,
      dueDate,
      section,
      kind,
      origin: "Generated",
      assignee: "",
      recipient: kind === "Communication" ? e.name : "",
    });
  if (
    !e.milestones.responded &&
    !e.finance.depositReceived &&
    !e.milestones.welcomeSent
  )
    add(
      "respond",
      "Respond to enquiry",
      addDays(e.createdDate, s.responseDays),
      "communications",
      "Communication",
    );
  if (
    e.milestones.responded &&
    !e.milestones.welcomeSent &&
    !e.finance.depositReceived
  )
    add(
      "welcome",
      "Discuss booking / send welcome and deposit details",
      addDays(e.milestones.responded, s.responseDays),
      "communications",
      "Communication",
    );
  if (e.milestones.welcomeSent && !e.finance.depositReceived)
    add(
      "deposit",
      "Check deposit receipt",
      addDays(e.milestones.welcomeSent, s.depositFollowupDays),
      "finance",
    );
  if (e.finance.depositReceived) {
    const missing = missingDetails(e);
    if (missing.length)
      add(
        "details",
        `Resolve ${missing.length} missing event detail${missing.length === 1 ? "" : "s"}`,
        e.eventDate ? weeksBefore(e, s.internalWeeks) : e.createdDate,
        "details",
      );
    for (const k of detailKeys)
      if (e.details[k].state === "Deferred")
        add(
          `deferred:${k}`,
          `Resolve deferred: ${detailLabels[k]}`,
          deferredDate(e, k, s) || e.createdDate,
          "details",
        );
    if (e.eventDate) {
      if (!musiciansReady(e))
        add(
          "musicians",
          "Organise musicians and music access",
          weeksBefore(e, s.musiciansWeeks),
          "musicians",
        );
      if (!repertoireReady(e))
        add(
          "repertoire",
          "Resolve and approve repertoire",
          weeksBefore(e, s.repertoireWeeks),
          "repertoire",
        );
      if (e.repertoire.some((r) => r.status === "Needs arranging"))
        add(
          "arrangements",
          "Finish pending arrangements",
          weeksBefore(e, s.arrangementsWeeks),
          "repertoire",
        );
      if (["Unknown", "Deferred"].includes(e.details.rehearsal.state))
        add(
          "rehearsal",
          "Resolve rehearsal arrangements",
          weeksBefore(e, s.rehearsalWeeks),
          "details",
        );
      if (!e.milestones.finalConfirmed)
        add(
          "final",
          "Confirm final running details",
          weeksBefore(e, s.finalCheckWeeks),
          "communications",
          "Communication",
        );
      if (balance(e) > 0)
        add(
          "balance",
          "Resolve outstanding client balance",
          weeksBefore(e, s.paymentWeeks),
          "finance",
        );
      if (today > e.eventDate) {
        if (e.musicians.some((m) => !m.paid && m.fee > 0))
          add(
            "pay-musicians",
            "Pay musicians",
            addDays(e.eventDate, s.postEventDays),
            "musicians",
          );
        if (!e.milestones.thankYouSent)
          add(
            "thanks",
            "Send post-event thank you",
            addDays(e.eventDate, s.postEventDays),
            "communications",
            "Communication",
          );
        if (!e.milestones.reviewRequested)
          add(
            "review",
            "Request a review",
            addDays(e.eventDate, s.postEventDays),
            "communications",
            "Communication",
          );
      }
    }
  }
  for (const t of e.tasks.filter((t) => !t.done))
    actions.push({
      ...t,
      eventId: e.id,
      eventName: e.name,
      section: "tasks",
      origin: "Manual",
    });
  return actions.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title),
  );
}
export function canArchive(
  e: EventRecord,
  s: Settings,
  today = businessToday(),
) {
  return (
    !!e.eventDate &&
    today > e.eventDate &&
    e.finance.depositReceived &&
    eventActions({ ...e, archived: false }, s, today).length === 0
  );
}
export function urgency(due: string, today = businessToday()) {
  return due < today
    ? "Overdue"
    : due === today
      ? "Today"
      : due <= addDays(today, 7)
        ? "This week"
        : "Later";
}
