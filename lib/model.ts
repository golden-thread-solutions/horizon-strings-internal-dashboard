import { z } from "zod";

export const date = z
  .string()
  .refine(
    (v) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v),
    "Use a valid date",
  );
const text = z.string().max(10000);
const short = z.string().max(300);
const amount = z
  .number()
  .finite()
  .min(0)
  .max(10000000)
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001,
    "Use at most two decimal places for money",
  );
export const detailLabels = {
  timing: "Playing / ceremony timing",
  venueSetup: "Position and setup at venue",
  wetWeather: "Wet-weather plan",
  onDayContact: "On-the-day contact",
  repertoireBrief: "Music preferences and requests",
  rehearsal: "Rehearsal requirements",
  logistics: "Chairs, shelter, dress and other logistics",
  runSheet: "Final running order",
} as const;
export type DetailKey = keyof typeof detailLabels;
export const detailKeys = Object.keys(detailLabels) as DetailKey[];
export const resolutionSchema = z
  .object({
    state: z.enum(["Unknown", "Filled", "Not Applicable", "Deferred"]),
    value: text,
    dueDate: date,
    trigger: z.enum(["", "Internal Organisation", "Final Details"]),
  })
  .superRefine((v, c) => {
    if (v.state === "Filled" && !v.value.trim())
      c.addIssue({
        code: "custom",
        message: "A filled detail needs a value",
        path: ["value"],
      });
    if (v.state === "Deferred" && !v.dueDate && !v.trigger)
      c.addIssue({
        code: "custom",
        message: "A deferred detail needs a date or workflow trigger",
        path: ["dueDate"],
      });
  });
export type Resolution = z.infer<typeof resolutionSchema>;
const contactSchema = z.object({
  id: z.uuid(),
  role: short,
  name: short,
  email: z.union([z.email(), z.literal("")]),
  phone: short,
  notes: text,
});
export const musicianSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(300),
  instrument: short,
  email: z.union([z.email(), z.literal("")]),
  phone: short,
  notes: text,
});
export const pieceSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(300),
  artist: short,
  musicUrl: z.union([
    z.url().refine((v) => /^https?:\/\//.test(v), "Use an http or https link"),
    z.literal(""),
  ]),
  notes: text,
});
export const taskSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(300),
  kind: z.enum(["Task", "Communication"]),
  dueDate: date.refine(Boolean, "Choose a due date"),
  assignee: short,
  recipient: short,
  notes: text,
  done: z.boolean(),
  completedAt: date,
});
export type ManualTask = z.infer<typeof taskSchema>;
export const settingsSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    internalWeeks: z.number().int().min(0).max(104),
    musiciansWeeks: z.number().int().min(0).max(104),
    repertoireWeeks: z.number().int().min(0).max(104),
    arrangementsWeeks: z.number().int().min(0).max(104),
    rehearsalWeeks: z.number().int().min(0).max(104),
    finalWeeks: z.number().int().min(0).max(104),
    finalCheckWeeks: z.number().int().min(0).max(104),
    paymentWeeks: z.number().int().min(0).max(104),
    responseDays: z.number().int().min(0).max(30),
    depositFollowupDays: z.number().int().min(0).max(90),
    postEventDays: z.number().int().min(0).max(90),
    readyRequiresPayment: z.boolean(),
    defaultsReviewed: z.boolean(),
  })
  .refine(
    (s) => s.internalWeeks >= s.finalWeeks && s.finalWeeks >= s.finalCheckWeeks,
    "Internal Organisation must start at least as early as Final Details, which must start at least as early as the final check",
  );
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  revision: 0,
  internalWeeks: 12,
  musiciansWeeks: 12,
  repertoireWeeks: 6,
  arrangementsWeeks: 4,
  rehearsalWeeks: 3,
  finalWeeks: 2,
  finalCheckWeeks: 1,
  paymentWeeks: 1,
  responseDays: 1,
  depositFollowupDays: 7,
  postEventDays: 7,
  readyRequiresPayment: true,
  defaultsReviewed: false,
};
export const eventSchema = z
  .object({
    id: z.uuid(),
    code: short,
    revision: z.number().int().nonnegative(),
    name: z.string().trim().min(1, "Name is required").max(300),
    eventDate: date,
    eventType: short,
    ensemble: z.enum([
      "",
      "Solo",
      "Duo",
      "Trio",
      "Quartet",
      "Quintet",
      "Sextet",
    ]),
    durationMinutes: z.number().int().min(0).max(1440),
    area: short,
    address: short,
    source: short,
    notes: text,
    createdDate: date.refine(Boolean),
    archived: z.boolean(),
    archiveReason: text,
    details: z.object(
      Object.fromEntries(
        detailKeys.map((k) => [k, resolutionSchema]),
      ) as Record<DetailKey, typeof resolutionSchema>,
    ),
    contacts: z.array(contactSchema).max(40),
    musicians: z
      .array(
        z.object({
          id: z.uuid(),
          musicianId: z.union([z.uuid(), z.literal("")]),
          name: short,
          instrument: short,
          confirmed: z.boolean(),
          musicSent: z.boolean(),
          contractRequired: z.boolean(),
          signed: z.boolean(),
          paid: z.boolean(),
          fee: amount,
          notes: text,
        }),
      )
      .max(30),
    repertoire: z
      .array(
        z.object({
          id: z.uuid(),
          pieceId: z.union([z.uuid(), z.literal("")]),
          title: short,
          moment: short,
          status: z.enum([
            "Requested",
            "Needs arranging",
            "Available",
            "Approved",
            "Not Applicable",
          ]),
          notes: text,
        }),
      )
      .max(150),
    finance: z.object({
      performance: amount,
      travel: amount,
      arrangements: amount,
      otherCharges: amount,
      depositRequired: amount,
      depositReceived: z.boolean(),
      depositAmount: amount,
      depositDate: date,
      finalReceived: amount,
      finalDate: date,
      invoiceReference: short,
      invoiceSent: z.boolean(),
      otherCosts: amount,
    }),
    milestones: z.object({
      responded: date,
      welcomeSent: date,
      finalConfirmed: date,
      thankYouSent: date,
      reviewRequested: date,
    }),
    communicationLog: z
      .array(
        z.object({
          id: z.uuid(),
          date: date.refine(Boolean),
          recipient: short,
          summary: z.string().trim().min(1).max(10000),
        }),
      )
      .max(500),
    tasks: z.array(taskSchema).max(500),
  })
  .superRefine((e, c) => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const completedDates = [
      ...Object.values(e.milestones),
      e.finance.depositDate,
      e.finance.finalDate,
      ...e.communicationLog.map((l) => l.date),
      ...e.tasks.map((t) => t.completedAt),
    ];
    if (completedDates.some((d) => d > today))
      c.addIssue({
        code: "custom",
        message:
          "Completed actions and received payments cannot be dated in the future",
      });
    if (
      e.finance.depositReceived &&
      (!e.finance.depositDate || e.finance.depositAmount <= 0)
    )
      c.addIssue({
        code: "custom",
        path: ["finance", "depositDate"],
        message: "Record the received deposit amount and date",
      });
    if (e.finance.finalReceived > 0 && !e.finance.finalDate)
      c.addIssue({
        code: "custom",
        path: ["finance", "finalDate"],
        message: "Record the balance payment date",
      });
    for (const list of [
      e.contacts,
      e.musicians,
      e.repertoire,
      e.tasks,
      e.communicationLog,
    ])
      if (new Set(list.map((x) => x.id)).size !== list.length)
        c.addIssue({ code: "custom", message: "Duplicate record identifiers" });
  });
export type EventRecord = z.infer<typeof eventSchema>;
export type Musician = z.infer<typeof musicianSchema>;
export type Piece = z.infer<typeof pieceSchema>;
export type Dataset = {
  events: EventRecord[];
  settings: Settings;
  musicians: Musician[];
  pieces: Piece[];
};
export function newEvent(name: string, today: string): EventRecord {
  return {
    id: crypto.randomUUID(),
    code: "",
    revision: 0,
    name,
    eventDate: "",
    eventType: "Wedding",
    ensemble: "",
    durationMinutes: 0,
    area: "",
    address: "",
    source: "Manual enquiry",
    notes: "",
    createdDate: today,
    archived: false,
    archiveReason: "",
    details: Object.fromEntries(
      detailKeys.map((k) => [
        k,
        { state: "Unknown", value: "", dueDate: "", trigger: "" },
      ]),
    ) as EventRecord["details"],
    contacts: [],
    musicians: [],
    repertoire: [],
    tasks: [],
    communicationLog: [],
    finance: {
      performance: 0,
      travel: 0,
      arrangements: 0,
      otherCharges: 0,
      depositRequired: 0,
      depositReceived: false,
      depositAmount: 0,
      depositDate: "",
      finalReceived: 0,
      finalDate: "",
      invoiceReference: "",
      invoiceSent: false,
      otherCosts: 0,
    },
    milestones: {
      responded: "",
      welcomeSent: "",
      finalConfirmed: "",
      thankYouSent: "",
      reviewRequested: "",
    },
  };
}
