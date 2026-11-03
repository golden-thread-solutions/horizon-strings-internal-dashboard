import type { EventRecord, WebsiteEnquiry } from "./model";

export function isLostEnquiry(event: EventRecord) {
  return event.archived && !event.deletedAt && !event.finance.depositReceived;
}

export type MoveSource = {
  kind: "event" | "enquiry";
  id: string;
  revision?: number;
};
export type LostDependencies = {
  event: (id: string) => EventRecord | undefined;
  enquiry: (id: string) => WebsiteEnquiry | undefined;
  convert: (id: string) => Promise<EventRecord>;
  save: (event: EventRecord) => Promise<EventRecord>;
};

export function prepareLostEnquiry(event: EventRecord, reason: string) {
  const trimmed = reason.trim();
  if (!trimmed)
    throw new Error("Enter the reason this enquiry did not proceed.");
  if (trimmed.length > 10000)
    throw new Error("Keep the reason under 10,000 characters.");
  if (event.deletedAt)
    throw new Error("This event is in Trash. Restore it before moving it.");
  if (event.finance.depositReceived)
    throw new Error(
      "This is a booked event. Open its workspace to handle cancellation; it cannot be marked as a lost enquiry.",
    );
  // A repeated attempt must not replace the first recorded reason.
  if (event.archived) return event;
  return { ...event, archived: true, archiveReason: trimmed };
}

export async function moveEnquiryToLost(
  source: MoveSource,
  reason: string,
  deps: LostDependencies,
) {
  if (!reason.trim())
    throw new Error("Enter the reason this enquiry did not proceed.");
  if (reason.trim().length > 10000)
    throw new Error("Keep the reason under 10,000 characters.");
  let event: EventRecord | undefined;
  if (source.kind === "enquiry") {
    const enquiry = deps.enquiry(source.id);
    if (!enquiry)
      throw new Error("This enquiry is no longer available. Reload the board.");
    if (enquiry.dashboardStatus === "converted" && !enquiry.dashboardEventId)
      throw new Error(
        "This enquiry has already been handled, but its linked event is unavailable. Reload before continuing.",
      );
    // The existing converter returns its linked event on repeat/concurrent attempts.
    // It also returns the latest booking/Trash facts, which are checked below.
    try {
      event = await deps.convert(source.id);
    } catch (error) {
      throw new Error(
        `The enquiry conversion was not confirmed. No Lost save was attempted. Reload the board before retrying; conversion uses the existing submission link to prevent duplicates. ${error instanceof Error ? error.message : "Please retry."}`,
      );
    }
  } else {
    event = deps.event(source.id);
    if (!event)
      throw new Error("This event is no longer available. Reload the board.");
    if (source.revision !== event.revision)
      throw new Error(
        "This event changed since you selected it. Reload and review it before trying again.",
      );
  }
  const candidate = prepareLostEnquiry(event, reason);
  if (candidate === event) return event;
  try {
    return await deps.save(candidate);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The save failed.";
    if (source.kind === "enquiry")
      throw new Error(
        `The enquiry may now have an event workspace, but marking it lost was not confirmed. Reload and review it before retrying. Its submission link prevents a duplicate. ${message}`,
      );
    throw error;
  }
}
