import test from "node:test";
import assert from "node:assert/strict";
import {
  newEvent,
  defaultSettings,
  type EventRecord,
  type WebsiteEnquiry,
} from "../lib/model";
import {
  isLostEnquiry,
  moveEnquiryToLost,
  prepareLostEnquiry,
  type LostDependencies,
} from "../lib/lost-enquiries";
import { boardCards, boardStages } from "../lib/board";
import { stageRequirements } from "../lib/board-moves";
import { eventActions } from "../lib/workflow";

const today = "2026-11-04";
function fixture() {
  const event = newEvent("Synthetic couple", today);
  event.revision = 1;
  const enquiry: WebsiteEnquiry = {
    id: crypto.randomUUID(),
    createdAt: `${today}T00:00:00Z`,
    name: "Synthetic website enquiry",
    email: "test@example.com",
    phone: "",
    preferredContact: "email",
    eventDate: "",
    venue: "",
    area: "",
    message: "",
    weddingPackage: "",
    requestedEnsemble: "",
    emailStatus: "sent",
    dashboardStatus: "new",
    dashboardEventId: "",
  };
  return { event, enquiry };
}

test("Lost requires a reason, never closes booked/trashed events, and preserves all workflow facts", () => {
  const { event } = fixture();
  event.milestones.responded = today;
  const before = structuredClone(event);
  assert.throws(() => prepareLostEnquiry(event, "  "), /reason/);
  assert.throws(
    () => prepareLostEnquiry({ ...event, deletedAt: today }, "Declined"),
    /Trash/,
  );
  assert.throws(
    () =>
      prepareLostEnquiry(
        { ...event, finance: { ...event.finance, depositReceived: true } },
        "Declined",
      ),
    /booked/,
  );
  const lost = prepareLostEnquiry(event, "  Chose another ensemble  ");
  assert.equal(isLostEnquiry(lost), true);
  assert.equal(lost.archiveReason, "Chose another ensemble");
  assert.deepEqual(event, before);
  assert.deepEqual({ ...lost, archived: false, archiveReason: "" }, event);
  assert.equal(eventActions(lost, defaultSettings, today).length, 0);
  assert.equal(isLostEnquiry({ ...lost, deletedAt: today }), false);
  assert.equal(
    isLostEnquiry({
      ...lost,
      finance: { ...lost.finance, depositReceived: true },
    }),
    false,
  );
  assert.equal(prepareLostEnquiry(lost, "New reason"), lost);
});

test("website conversion followed by a failed Lost save is recoverable and never duplicates", async () => {
  const { event, enquiry } = fixture();
  let current = { ...event },
    convertCalls = 0,
    saveCalls = 0,
    fail = true;
  const deps: LostDependencies = {
    event: () => current,
    enquiry: () => enquiry,
    convert: async () => {
      convertCalls++;
      enquiry.dashboardStatus = "converted";
      enquiry.dashboardEventId = current.id;
      return current;
    },
    save: async (candidate) => {
      saveCalls++;
      if (fail) throw new Error("Synthetic connection failure");
      current = { ...candidate, revision: candidate.revision + 1 };
      return current;
    },
  };
  const source = { kind: "enquiry" as const, id: enquiry.id };
  await assert.rejects(
    moveEnquiryToLost(source, "No longer needed", deps),
    /marking it lost was not confirmed/,
  );
  assert.equal(current.archived, false);
  assert.equal(enquiry.dashboardEventId, current.id);
  fail = false;
  await moveEnquiryToLost(source, "No longer needed", deps);
  assert.equal(isLostEnquiry(current), true);
  await moveEnquiryToLost(source, "Different retry reason", deps);
  assert.equal(current.archiveReason, "No longer needed");
  assert.equal(saveCalls, 2);
  assert.equal(convertCalls, 3);
  assert.equal(
    boardCards(
      {
        events: [current],
        settings: defaultSettings,
        websiteEnquiries: [enquiry],
      },
      today,
    ).length,
    0,
  );
});

test("invalid or already handled website enquiry does not convert; failed conversion never attempts a Lost save", async () => {
  const { event, enquiry } = fixture();
  let converts = 0,
    saves = 0;
  const deps: LostDependencies = {
    event: () => event,
    enquiry: () => enquiry,
    convert: async () => {
      converts++;
      throw new Error("Synthetic sync failure");
    },
    save: async (e) => {
      saves++;
      return e;
    },
  };
  const source = { kind: "enquiry" as const, id: enquiry.id };
  await assert.rejects(moveEnquiryToLost(source, "", deps), /reason/);
  await assert.rejects(
    moveEnquiryToLost(source, "a".repeat(10001), deps),
    /10,000/,
  );
  assert.equal(converts, 0);
  await assert.rejects(
    moveEnquiryToLost(source, "Declined", deps),
    /No Lost save was attempted/,
  );
  assert.equal(saves, 0);
  assert.equal(converts, 1);
  enquiry.dashboardStatus = "converted";
  await assert.rejects(
    moveEnquiryToLost(source, "Declined", deps),
    /linked event is unavailable/,
  );
  assert.equal(converts, 1);
});

test("stale event or newly booked converted event cannot be marked lost", async () => {
  const { event, enquiry } = fixture();
  let saves = 0;
  const deps: LostDependencies = {
    event: () => ({ ...event, revision: 2 }),
    enquiry: () => enquiry,
    convert: async () => ({
      ...event,
      finance: { ...event.finance, depositReceived: true },
    }),
    save: async (e) => {
      saves++;
      return e;
    },
  };
  await assert.rejects(
    moveEnquiryToLost(
      { kind: "event", id: event.id, revision: 1 },
      "Declined",
      deps,
    ),
    /changed/,
  );
  await assert.rejects(
    moveEnquiryToLost({ kind: "enquiry", id: enquiry.id }, "Declined", deps),
    /booked/,
  );
  assert.equal(saves, 0);
});

test("all active destinations describe real gates without changing recorded facts", () => {
  const { event } = fixture(),
    before = structuredClone(event);
  for (const target of boardStages) {
    const plan = stageRequirements(event, defaultSettings, target, today);
    assert.ok(plan.description);
    assert.ok(plan.section);
  }
  assert.match(
    stageRequirements(
      event,
      defaultSettings,
      "Details Pending",
      today,
    ).items.join(" "),
    /actual deposit/,
  );
  assert.match(
    stageRequirements(event, defaultSettings, "Event Day", today).items.join(
      " ",
    ),
    /automatically/,
  );
  assert.match(
    stageRequirements(
      event,
      defaultSettings,
      "Pending Booking",
      today,
    ).items.join(" "),
    /actual sent date/,
  );
  assert.match(
    stageRequirements(undefined, defaultSettings, "Pending Enquiry", today)
      .items[0],
    /website enquiry/,
  );
  assert.deepEqual(event, before);
});
