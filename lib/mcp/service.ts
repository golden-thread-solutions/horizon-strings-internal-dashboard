import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  eventSchema,
  settingsSchema,
  musicianSchema,
  pieceSchema,
  websiteEnquirySchema,
  type Dataset,
} from "../model";
import {
  businessToday,
  deriveStage,
  eventActions,
  readiness,
  totalFee,
  received,
  balance,
} from "../workflow";
import { HorizonMcpError } from "./auth";
import { mcpConfig } from "./config";

export const pageInput = z
  .object({
    query: z.string().max(300).default(""),
    offset: z.number().int().min(0).max(1000000).default(0),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();
export type PageInput = z.input<typeof pageInput>;
const snapshot = z.object({
  events: z.array(eventSchema),
  settings: settingsSchema,
  musicians: z.array(musicianSchema),
  pieces: z.array(pieceSchema),
  websiteEnquiries: z.array(websiteEnquirySchema),
});
function searchableText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(searchableText).join(" ");
  if (value && typeof value === "object")
    return Object.values(value).map(searchableText).join(" ");
  return "";
}

// Never invoke the normal workspace loader: it converts website enquiries on read.
export class HorizonService {
  constructor(private readonly db: Pick<SupabaseClient, "rpc">) {}
  async assertAccess() {
    const { data, error } = await this.db.rpc("hs_mcp_can_read");
    if (error)
      throw new HorizonMcpError(
        503,
        "unavailable",
        "Dashboard access checks are unavailable.",
      );
    if (data !== true)
      throw new HorizonMcpError(
        403,
        "access_denied",
        "Dashboard read access has not been granted or has been revoked.",
      );
  }
  async data(): Promise<Dataset> {
    const { data, error } = await this.db.rpc("hs_mcp_read_workspace");
    if (error)
      throw new HorizonMcpError(
        error.code === "42501" ? 403 : 503,
        "access_denied",
        "Dashboard read access is unavailable or has been revoked.",
      );
    const parsed = snapshot.safeParse(data);
    if (!parsed.success)
      throw new HorizonMcpError(
        503,
        "invalid_snapshot",
        "Dashboard data could not be read safely.",
      );
    return parsed.data;
  }
  private page<T>(records: T[], input: PageInput, text: (record: T) => string) {
    const p = pageInput.parse(input),
      query = p.query.trim().toLocaleLowerCase("en-AU");
    const matched = records.filter(
      (record) =>
        !query || text(record).toLocaleLowerCase("en-AU").includes(query),
    );
    return {
      records: matched.slice(p.offset, p.offset + p.limit),
      nextOffset:
        p.offset + p.limit < matched.length ? p.offset + p.limit : null,
      total: matched.length,
    };
  }
  async events(input: PageInput & { includeArchived?: boolean }) {
    const { includeArchived = false, ...page } = input,
      data = await this.data(),
      today = businessToday();
    const records = data.events
      .filter((e) => includeArchived || !e.archived)
      .sort(
        (a, b) =>
          a.eventDate.localeCompare(b.eventDate) || a.id.localeCompare(b.id),
      );
    return this.page(
      records.map((e) => ({
        id: e.id,
        code: e.code,
        name: e.name,
        eventDate: e.eventDate,
        eventType: e.eventType,
        area: e.area,
        ensemble: e.ensemble,
        archived: e.archived,
        revision: e.revision,
        stage: deriveStage(e, data.settings, today),
        totalFee: totalFee(e),
        received: received(e),
        balance: balance(e),
      })),
      page,
      (e) =>
        `${e.code} ${e.name} ${e.eventDate} ${e.eventType} ${e.area} ${e.stage}`,
    );
  }
  async event(id: string) {
    const data = await this.data(),
      event = data.events.find((e) => e.id === id);
    if (!event) throw new HorizonMcpError(404, "not_found", "Event not found.");
    return {
      event,
      stage: deriveStage(event, data.settings),
      readiness: readiness(event, data.settings),
      actions: eventActions(event, data.settings),
      url: `${mcpConfig().origin}/clients/${event.id}`,
    };
  }
  async actions(input: PageInput) {
    const data = await this.data();
    return this.page(
      data.events
        .flatMap((e) => eventActions(e, data.settings))
        .sort(
          (a, b) =>
            a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
        ),
      input,
      (a) =>
        `${a.title} ${a.eventName} ${a.section} ${a.assignee} ${a.dueDate}`,
    );
  }
  async directory(kind: "musicians" | "repertoire", input: PageInput) {
    const data = await this.data();
    return kind === "musicians"
      ? this.page(
          data.musicians.sort(
            (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
          ),
          input,
          (m) => `${m.name} ${m.instrument} ${m.notes}`,
        )
      : this.page(
          data.pieces.sort(
            (a, b) =>
              a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
          ),
          input,
          (p) => `${p.title} ${p.artist} ${p.genre} ${p.notes}`,
        );
  }
  async enquiries(input: PageInput) {
    const data = await this.data();
    return this.page(
      data.websiteEnquiries.sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      ),
      input,
      (e) => `${e.name} ${e.eventDate} ${e.venue} ${e.area} ${e.message}`,
    );
  }
  async settings() {
    return {
      settings: (await this.data()).settings,
      today: businessToday(),
      timezone: "Australia/Sydney",
      readOnly: true,
    };
  }
  async search(query: string) {
    const data = await this.data(),
      q = query.trim().toLowerCase(),
      origin = mcpConfig().origin;
    const records = [
      ...data.events.map((e) => ({
        id: `event:${e.id}`,
        title: `${e.code} ${e.name}`,
        text: searchableText(e),
        url: `${origin}/clients/${e.id}`,
      })),
      ...data.musicians.map((e) => ({
        id: `musician:${e.id}`,
        title: e.name,
        text: `${e.name} ${e.instrument} ${e.notes}`,
        url: `${origin}/musicians`,
      })),
      ...data.pieces.map((e) => ({
        id: `piece:${e.id}`,
        title: e.title,
        text: `${e.title} ${e.artist} ${e.notes}`,
        url: `${origin}/repertoire`,
      })),
      ...data.websiteEnquiries.map((e) => ({
        id: `enquiry:${e.id}`,
        title: e.name,
        text: `${e.name} ${e.message} ${e.area}`,
        url: `${origin}/clients`,
      })),
    ];
    const results = records.filter(
      (e) => !q || e.text.toLowerCase().includes(q),
    );
    return {
      results: results.slice(0, 50).map(({ text, ...e }) => e),
      truncated: results.length > 50,
    };
  }
  async fetch(id: string) {
    const match = /^(event|musician|piece|enquiry):([a-f0-9-]{36})$/i.exec(id);
    if (!match)
      throw new HorizonMcpError(
        400,
        "invalid_id",
        "Use an ID returned by search.",
      );
    const data = await this.data(),
      [, kind, key] = match;
    const record =
      kind === "event"
        ? data.events.find((e) => e.id === key)
        : kind === "musician"
          ? data.musicians.find((e) => e.id === key)
          : kind === "piece"
            ? data.pieces.find((e) => e.id === key)
            : data.websiteEnquiries.find((e) => e.id === key);
    if (!record)
      throw new HorizonMcpError(404, "not_found", "Record not found.");
    const title = "name" in record ? record.name : record.title;
    const path =
      kind === "event"
        ? `/clients/${key}`
        : kind === "musician"
          ? "/musicians"
          : kind === "piece"
            ? "/repertoire"
            : "/clients";
    return {
      id,
      title,
      text: JSON.stringify(record),
      url: `${mcpConfig().origin}${path}`,
      metadata: { source: "Horizon Strings dashboard", readOnly: true },
    };
  }
}
