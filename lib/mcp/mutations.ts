import { z } from "zod";
import {
  eventSchema,
  musicianSchema,
  pieceSchema,
  settingsSchema,
} from "../model";

const revision = z.number().int().nonnegative();
const common = {
  requestId: z.uuid(),
  id: z.uuid(),
  expectedRevision: revision,
};
const eventFields = z
  .object(eventSchema.shape)
  .pick({
    name: true,
    eventDate: true,
    eventType: true,
    ensemble: true,
    durationMinutes: true,
    area: true,
    address: true,
    source: true,
    notes: true,
    details: true,
    operational: true,
    milestones: true,
  })
  .partial()
  .extend({
    details: eventSchema.shape.details.partial().strict().optional(),
    milestones: eventSchema.shape.milestones.partial().strict().optional(),
  })
  .strict();
const nonempty = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.refine(
    (value) => Object.keys(value).length > 0,
    "Supply at least one field",
  );
const item = <C extends string, T extends z.ZodType>(collection: C, data: T) =>
  z
    .object({
      ...common,
      operation: z.literal("set_event_item"),
      collection: z.literal(collection),
      data,
    })
    .strict();
export const mutationSchema = z.union([
  z
    .object({
      ...common,
      operation: z.literal("create_event"),
      name: z.string().trim().min(1).max(300),
      expectedRevision: z.literal(0),
    })
    .strict(),
  z
    .object({
      ...common,
      operation: z.literal("update_event"),
      patch: nonempty(eventFields),
    })
    .strict(),
  item("contacts", eventSchema.shape.contacts.element.strict()),
  item("tasks", eventSchema.shape.tasks.element.strict()),
  item("repertoire", eventSchema.shape.repertoire.element.strict()),
  item("communicationLog", eventSchema.shape.communicationLog.element.strict()),
  item(
    "musicians",
    eventSchema.shape.musicians.element
      .omit({ fee: true, paid: true })
      .strict(),
  ),
  z
    .object({
      ...common,
      operation: z.literal("save_musician"),
      data: musicianSchema.omit({ id: true, revision: true }).strict(),
    })
    .strict(),
  z
    .object({
      ...common,
      operation: z.literal("save_piece"),
      data: pieceSchema.omit({ id: true, revision: true }).strict(),
    })
    .strict(),
  z
    .object({
      requestId: z.uuid(),
      operation: z.literal("update_settings"),
      expectedRevision: revision,
      patch: nonempty(
        z
          .object(settingsSchema.shape)
          .omit({ revision: true })
          .partial()
          .strict(),
      ),
    })
    .strict(),
]);
export type Mutation = z.infer<typeof mutationSchema>;
