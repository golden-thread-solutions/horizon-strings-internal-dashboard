import { z } from "zod";
import {
  eventSchema,
  musicianSchema,
  pieceSchema,
  settingsSchema,
  detailKeys,
} from "../model";
import { operationalFields } from "../event-details";

const short = z.string().max(300),
  text = z.string().max(10000);
const day = z.union([z.literal(""), z.iso.date()]);
const revision = z.number().int().min(0).max(2147483646);
const base = { requestId: z.uuid(), id: z.uuid(), expectedRevision: revision };
const partialGroups = Object.fromEntries(
  detailKeys.map((key) => [
    key,
    z
      .object(
        Object.fromEntries(
          operationalFields[key].flatMap((field) => [
            [
              field.key,
              field.type === "number"
                ? z.union([
                    z.literal(""),
                    z
                      .number()
                      .min(0)
                      .max(field.key === "guestCount" ? 100000 : 1440),
                  ])
                : field.type === "date"
                  ? day
                  : field.type === "time"
                    ? z.union([
                        z.literal(""),
                        z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
                      ])
                    : text,
            ],
            [`__notApplicable:${field.key}`, z.enum(["true", "false"])],
          ]),
        ),
      )
      .strict()
      .partial()
      .optional(),
  ]),
);
const detail = z
  .object({
    state: z.enum(["Unknown", "Filled", "Not Applicable", "Deferred"]),
    value: text,
    dueDate: day,
    trigger: z.enum(["", "Internal Organisation", "Final Details"]),
  })
  .strict();
const patch = z
  .object({
    name: z.string().trim().min(1).max(300),
    eventDate: day,
    eventType: short,
    ensemble: eventSchema.shape.ensemble,
    durationMinutes: eventSchema.shape.durationMinutes,
    area: short,
    address: short,
    source: short,
    notes: text,
    details: z
      .object(Object.fromEntries(detailKeys.map((k) => [k, detail.optional()])))
      .strict(),
    operational: z.object(partialGroups).strict(),
    milestones: z
      .object({
        responded: day,
        welcomeSent: day,
        finalConfirmed: day,
        thankYouSent: day,
        reviewRequested: day,
      })
      .strict()
      .partial(),
  })
  .strict()
  .partial();
const contact = eventSchema.shape.contacts.element.strict();
const assignment = eventSchema.shape.musicians.element
  .omit({ fee: true, paid: true })
  .strict();
const repertoire = eventSchema.shape.repertoire.element.strict();
const task = eventSchema.shape.tasks.element
  .extend({ dueDate: z.iso.date(), completedAt: day })
  .strict();
const communication = eventSchema.shape.communicationLog.element
  .extend({ date: z.iso.date() })
  .strict();
const directoryBase = { ...base };

// These closed command shapes also generate the independently enforced SQL contract.
export const writeInputs = {
  create_event: z
    .object({ ...base, data: patch.required({ name: true }) })
    .strict(),
  update_event: z.object({ ...base, data: patch }).strict(),
  upsert_event_contact: z.object({ ...base, data: contact }).strict(),
  upsert_event_task: z.object({ ...base, data: task }).strict(),
  record_event_communication: z
    .object({ ...base, data: communication })
    .strict(),
  upsert_event_musician: z.object({ ...base, data: assignment }).strict(),
  upsert_event_repertoire: z.object({ ...base, data: repertoire }).strict(),
  upsert_musician: z
    .object({
      ...directoryBase,
      data: musicianSchema.omit({ id: true, revision: true }).strict(),
    })
    .strict(),
  upsert_piece: z
    .object({
      ...directoryBase,
      data: pieceSchema.omit({ id: true, revision: true }).strict(),
    })
    .strict(),
  update_workflow_settings: z
    .object({
      requestId: z.uuid(),
      expectedRevision: revision,
      data: z
        .object(settingsSchema.shape)
        .omit({ revision: true })
        .strict()
        .partial(),
    })
    .strict(),
};
export type WriteOperation = keyof typeof writeInputs;
export function databaseCommandSchemas() {
  return Object.fromEntries(
    Object.entries(writeInputs).map(([key, schema]) => [
      key,
      z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }),
    ]),
  );
}
export const writeDescriptions: Record<WriteOperation, string> = {
  create_event:
    "Create an event with a name and optional operational facts. Use expectedRevision=0 and a new stable event UUID. Financial defaults are set by the server.",
  update_event:
    "Patch event facts, notes, operational fields, detail resolutions or recorded milestones. Omitted fields and groups are preserved. Does not send messages or alter finances, archive, Lost or Trash state.",
  upsert_event_contact:
    "Add or update one event contact by its UUID; preserve all other contacts.",
  upsert_event_task:
    "Add or update one event-linked task or communication action by UUID; preserve other tasks. Does not send anything. General business tasks are excluded.",
  record_event_communication:
    "Record or correct one communication history entry by UUID. Recording a communication never sends it or changes milestones implicitly.",
  upsert_event_musician:
    "Add or update one musician assignment by UUID. Preserve all other assignments and existing fee/payment facts. New assignments start with fee=0 and paid=false; money changes require the owner dashboard.",
  upsert_event_repertoire:
    "Add or update one event repertoire item by UUID; preserve all other items.",
  upsert_musician:
    "Create (expectedRevision=0) or update a musician directory record using its latest directory revision. Does not manage People, fees or payments.",
  upsert_piece:
    "Create (expectedRevision=0) or update a repertoire directory record using its latest directory revision. Saves music links without downloading files.",
  update_workflow_settings:
    "Patch workflow timing/readiness settings using the latest settings revision; omitted settings are preserved.",
};
