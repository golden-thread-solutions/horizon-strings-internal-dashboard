import type { EventRecord, Settings } from "./model";
import { boardStages } from "./board";
import {
  deriveStage,
  missingDetails,
  readiness,
  weeksBefore,
  formatDate,
} from "./workflow";

export type ActiveStage = (typeof boardStages)[number];
const explanations: Record<ActiveStage, string> = {
  "New Enquiry":
    "No enquiry response, welcome message or received deposit is recorded.",
  "Pending Enquiry":
    "An enquiry response is recorded; the welcome message and deposit are still outstanding.",
  "Pending Booking":
    "The welcome/deposit message is recorded; the deposit has not yet been received.",
  "Details Pending":
    "A deposit is received. Event information is unresolved, or the internal preparation period has not yet started.",
  "Internal Organisation":
    "Initial details are resolved and the internal preparation period has started.",
  "Final Details":
    "Initial details are resolved and the final preparation period has started, with readiness work outstanding.",
  "Event Ready":
    "The final preparation period has started and all required pre-event work is resolved.",
  "Event Day": "The booked event's actual date is today in Australia/Sydney.",
  "Post-event":
    "The booked event's actual date is before today in Australia/Sydney.",
};
export function stageRequirements(
  event: EventRecord | undefined,
  settings: Settings,
  target: ActiveStage,
  today: string,
) {
  const section =
    target === "Pending Enquiry" || target === "Pending Booking"
      ? "communications"
      : target === "Details Pending"
        ? "finance"
        : target === "Event Day" || target === "Post-event"
          ? "main"
          : "details";
  const items: string[] = [];
  const index = boardStages.indexOf(target);
  if (!event)
    items.push(
      "Open the website enquiry and add it to an event workspace before recording workflow facts.",
    );
  else {
    const current = deriveStage(event, settings, today);
    if (
      index < 3 &&
      (event.finance.depositReceived ||
        (target === "New Enquiry" &&
          (event.milestones.responded || event.milestones.welcomeSent)) ||
        (target === "Pending Enquiry" && event.milestones.welcomeSent))
    )
      items.push(
        "Later milestones are already recorded. Only correct those facts if they are inaccurate; dragging will not erase them.",
      );
    if (target === "Pending Enquiry" && !event.milestones.responded)
      items.push("Record the actual enquiry response in Communications.");
    if (target === "Pending Booking" && !event.milestones.welcomeSent)
      items.push(
        "Send the welcome/deposit message, then record its actual sent date.",
      );
    if (index >= 3 && !event.finance.depositReceived)
      items.push(
        "Record the actual deposit received, its amount and receipt date in Finance.",
      );
    if (index >= 4 && index <= 6) {
      items.push(...missingDetails(event).map((name) => `Resolve: ${name}.`));
      if (!event.eventDate)
        items.push(
          "Set the actual event date so preparation thresholds can be calculated.",
        );
      else if (
        today <
        weeksBefore(
          event,
          index >= 5 ? settings.finalWeeks : settings.internalWeeks,
        )
      )
        items.push(
          `This preparation period starts ${formatDate(weeksBefore(event, index >= 5 ? settings.finalWeeks : settings.internalWeeks))} under the current timing settings.`,
        );
    }
    if (target === "Event Ready") {
      const alreadyListed = new Set(missingDetails(event));
      items.push(
        ...readiness(event, settings).filter(
          (item) => !alreadyListed.has(item),
        ),
      );
    }
    if (target === "Event Day" && event.eventDate !== today)
      items.push(
        "Event Day is selected automatically on the event's actual Sydney date. Do not change the date merely to move a card.",
      );
    if (
      target === "Post-event" &&
      (!event.eventDate || event.eventDate >= today)
    )
      items.push(
        "Post-event begins after the event's actual Sydney date; dragging does not confirm a performance.",
      );
    if (current !== target && !items.length)
      items.push(
        `The saved facts currently place this event in ${current}. Keep accurate facts; the board will select the appropriate stage automatically.`,
      );
  }
  return {
    description: explanations[target],
    items: [...new Set(items)],
    section,
  };
}
