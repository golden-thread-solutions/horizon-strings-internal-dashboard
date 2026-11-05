import type { Dataset, EventRecord, Settings, WebsiteEnquiry } from "./model";
import { deriveStage, totalFee } from "./workflow";

export const boardStages = [
  "New Enquiry",
  "Pending Enquiry",
  "Pending Booking",
  "Details Pending",
  "Internal Organisation",
  "Final Details",
  "Event Ready",
  "Event Day",
  "Post-event",
] as const;
export type BoardCard = {
  id: string;
  kind: "event" | "enquiry";
  name: string;
  date: string;
  area: string;
  value: number | null;
  stage: string;
  code: string;
  href: string;
  revision?: number;
};
// Converted history must never become a duplicate card, even if its link is absent.
export function pendingWebsiteEnquiries(enquiries: WebsiteEnquiry[]) {
  return enquiries.filter(
    (e) => e.dashboardStatus === "new" && !e.dashboardEventId,
  );
}
export function eventCard(
  e: EventRecord,
  settings: Settings,
  today: string,
): BoardCard {
  return {
    id: e.id,
    revision: e.revision,
    kind: "event",
    name: e.name,
    date: e.eventDate,
    area: e.area,
    value: totalFee(e) > 0 ? totalFee(e) : null,
    stage: deriveStage(e, settings, today),
    code: e.code,
    href: `/clients/${e.id}`,
  };
}
export function boardCards(
  data: Pick<Dataset, "events" | "settings" | "websiteEnquiries">,
  today: string,
) {
  const events = data.events
    .filter((e) => !e.archived && !e.deletedAt)
    .map((e) => eventCard(e, data.settings, today));
  const enquiries: BoardCard[] = pendingWebsiteEnquiries(
    data.websiteEnquiries,
  ).map((e) => ({
    id: e.id,
    kind: "enquiry",
    name: e.name,
    date: e.eventDate,
    area: e.area,
    value: null,
    stage: "New Enquiry",
    code: "",
    href: `/enquiries/${e.id}`,
  }));
  return [...events, ...enquiries].sort(
    (a, b) =>
      (a.date || "9999").localeCompare(b.date || "9999") ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
}
