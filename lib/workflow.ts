import { EventRecord, HorizonTask, workflowSettings } from "@/data/horizon";

const today = new Date("2026-08-30T00:00:00+10:00");

export function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDate(value?: string) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

export function isOverdue(task: HorizonTask) {
  if (!task.dueDate || task.status === "Done") return false;
  return new Date(`${task.dueDate}T00:00:00`) < today;
}

export function isDueSoon(task: HorizonTask) {
  if (!task.dueDate || task.status === "Done") return false;
  const due = new Date(`${task.dueDate}T00:00:00`);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= 7;
}

export function eventProfit(event: EventRecord) {
  return event.finance.quotedAmount - event.finance.musicianCosts - event.finance.otherCosts;
}

export function balanceOutstanding(event: EventRecord) {
  return Math.max(0, event.finance.quotedAmount - event.finance.depositReceived);
}

export function missingFields(event: EventRecord) {
  const missing: string[] = [];

  if (!event.eventDate) missing.push("Event date");
  if (!event.mainDetails.ensemble) missing.push("Ensemble/package");
  if (!event.mainDetails.playingMinutes) missing.push("Playing duration");
  if (!event.contacts.some((contact) => contact.role === "Main contact" && contact.name && contact.phone)) {
    missing.push("Main contact phone");
  }
  if (!event.location.area && !event.location.address) missing.push("Location");
  if (!event.timings.playStart && !event.timings.ceremonyStart) missing.push("Start time");
  if (event.eventType === "Wedding" && !event.contacts.some((contact) => contact.role === "On the day contact" && contact.name)) {
    missing.push("On-the-day contact");
  }

  return missing;
}

export function blockers(event: EventRecord) {
  const items: string[] = [];
  const missing = missingFields(event);

  if (missing.length) items.push(`${missing.length} missing info item${missing.length === 1 ? "" : "s"}`);
  if (["Booking Pending", "Booked", "Planning", "Ready", "Completed"].includes(event.stage) && !event.finance.depositInvoiceSent) {
    items.push("Deposit invoice not sent");
  }
  if (event.stage !== "Closed" && event.finance.quotedAmount > 0 && !event.finance.finalPaid && new Date(`${event.eventDate}T00:00:00`) < today) {
    items.push("Payment not closed");
  }
  if (event.stage !== "New" && event.finance.depositRequired > event.finance.depositReceived) {
    items.push("Deposit not received");
  }
  if (event.mainDetails.ensemble && event.musicians.filter((person) => person.confirmed).length === 0 && ["Booked", "Planning", "Ready"].includes(event.stage)) {
    items.push("No confirmed musicians");
  }
  if (event.repertoire.some((piece) => piece.status === "Needs arranging")) {
    items.push("Arrangement work required");
  }
  if (event.logistics.Shelter === "Needs confirmation") {
    items.push("Shelter needs confirmation");
  }

  return items;
}

export function checkpointStatus(event: EventRecord) {
  const eventDate = event.eventDate ? new Date(`${event.eventDate}T00:00:00`) : null;
  const setlistDue = eventDate ? offsetDate(eventDate, -workflowSettings.setlistSortedDaysBeforeEvent) : undefined;
  const musiciansDue = eventDate ? offsetDate(eventDate, -workflowSettings.musiciansSortedDaysBeforeEvent) : undefined;
  const sortedMusicians = event.mainDetails.ensemble
    ? event.musicians.length > 0 && event.musicians.every((person) => person.confirmed)
    : false;
  const sortedSetlist = event.repertoire.length > 0 && event.repertoire.every((piece) =>
    ["Available", "Approved", "N/A"].includes(piece.status)
  );

  return [
    {
      label: "Deposit invoice sent",
      done: event.finance.depositInvoiceSent,
      dueDate: event.createdDate,
      detail: event.finance.depositInvoiceSent ? "Sent" : "Needs sending"
    },
    {
      label: "Deposit received",
      done: event.finance.depositReceived >= event.finance.depositRequired && event.finance.depositRequired > 0,
      dueDate: event.createdDate,
      detail: `${money(event.finance.depositReceived)} / ${money(event.finance.depositRequired)}`
    },
    {
      label: "Musicians sorted",
      done: sortedMusicians,
      dueDate: musiciansDue,
      detail: sortedMusicians ? "Confirmed" : "Needs confirmation"
    },
    {
      label: "Setlist sorted",
      done: sortedSetlist,
      dueDate: setlistDue,
      detail: sortedSetlist ? "Ready" : "Pieces unresolved"
    }
  ];
}

export function generatedCheckpointTasks(event: EventRecord): HorizonTask[] {
  return checkpointStatus(event)
    .filter((checkpoint) => !checkpoint.done)
    .map((checkpoint, index) => ({
      id: `C-${event.id}-${index}`,
      eventId: event.id,
      title: checkpoint.label,
      status: "Not started",
      dueDate: checkpoint.dueDate,
      source:
        checkpoint.label === "Setlist sorted"
          ? "Repertoire"
          : checkpoint.label === "Musicians sorted"
            ? "Musicians"
            : "Finance",
      priority: isCheckpointOverdue(checkpoint.dueDate) ? "High" : "Medium",
      notes: checkpoint.detail
    }));
}

function offsetDate(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function isCheckpointOverdue(dueDate?: string) {
  if (!dueDate) return false;
  return new Date(`${dueDate}T00:00:00`) < today;
}

export function nextAction(event: EventRecord) {
  const openTasks = event.tasks
    .filter((task) => task.status !== "Done")
    .sort((a, b) => {
      if (isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
      return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
    });

  if (openTasks[0]) return openTasks[0].title;
  const eventBlockers = blockers(event);
  if (eventBlockers[0]) return eventBlockers[0];
  if (event.stage === "Completed") return "Close post-event admin";
  return "No immediate action";
}

export function allTasks(events: EventRecord[]) {
  return events.flatMap((event) =>
    [...event.tasks, ...generatedCheckpointTasks(event)].map((task) => ({
      ...task,
      eventName: event.clientName,
      eventDate: event.eventDate
    }))
  );
}
