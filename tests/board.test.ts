import test from "node:test";
import assert from "node:assert/strict";
import { boardCards, boardStages } from "../lib/board";
import {
  newEvent,
  defaultSettings,
  type Dataset,
  type WebsiteEnquiry,
} from "../lib/model";
import { eventActions } from "../lib/workflow";
import { assignedPerson } from "../lib/people";
const today = "2026-11-02";
function enquiry(): WebsiteEnquiry {
  return {
    id: crypto.randomUUID(),
    createdAt: `${today}T00:00:00Z`,
    name: "Synthetic enquiry",
    email: "test@example.com",
    phone: "",
    preferredContact: "email",
    eventDate: "",
    venue: "",
    area: "Test area",
    message: "",
    weddingPackage: "",
    requestedEnsemble: "",
    emailStatus: "sent",
    dashboardStatus: "new",
    dashboardEventId: "",
  };
}
test("nine active stages, one card per enquiry/event, no archived or trashed records", () => {
  const active = newEvent("Synthetic couple", today),
    archived = { ...newEvent("Archived", today), archived: true },
    deleted = { ...newEvent("Deleted", today), deletedAt: today };
  active.finance.performance = 1200;
  active.finance.travel = 100;
  active.finance.depositReceived = true;
  active.finance.depositAmount = 400;
  active.finance.depositDate = today;
  const pending = enquiry(),
    linked = {
      ...enquiry(),
      dashboardStatus: "converted" as const,
      dashboardEventId: active.id,
    },
    deletedLink = {
      ...enquiry(),
      dashboardStatus: "converted" as const,
      dashboardEventId: deleted.id,
    },
    noLink = { ...enquiry(), dashboardStatus: "converted" as const };
  const data: Dataset = {
    events: [active, archived, deleted],
    settings: defaultSettings,
    musicians: [],
    pieces: [],
    websiteEnquiries: [pending, linked, deletedLink, noLink],
  };
  const cards = boardCards(data, today);
  assert.equal(boardStages.length, 9);
  assert.equal(cards.length, 2);
  assert.equal(cards.find((c) => c.id === active.id)?.value, 1300); // total fee, never remaining balance
  assert.equal(cards.find((c) => c.id === pending.id)?.value, null);
  assert.equal(cards.find((c) => c.id === pending.id)?.stage, "New Enquiry");
  assert.equal(cards.find((c) => c.id === active.id)?.stage, "Details Pending");
  assert.equal(eventActions(deleted, defaultSettings, today).length, 0);
});
test("board dates sort chronologically with undated enquiries last", () => {
  const a = newEvent("Later", today),
    b = newEvent("Earlier", today),
    c = newEvent("Undated", today);
  a.eventDate = "2027-01-20";
  b.eventDate = "2026-12-20";
  const cards = boardCards(
    { events: [c, a, b], settings: defaultSettings, websiteEnquiries: [] },
    today,
  );
  assert.deepEqual(
    cards.map((c) => c.name),
    ["Earlier", "Later", "Undated"],
  );
});

test("assignment filters preserve existing names while new assignments use stable IDs", () => {
  const koby = {
    id: crypto.randomUUID(),
    revision: 1,
    name: "Koby",
    active: true,
  };
  assert.equal(assignedPerson([koby], " KOBY ")?.id, koby.id);
  assert.equal(assignedPerson([koby], koby.id)?.name, "Koby");
  assert.equal(assignedPerson([koby], "Mia"), undefined);
});
