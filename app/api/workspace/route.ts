import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestSupabase } from "@/lib/supabase";
import {
  eventSchema,
  settingsSchema,
  musicianSchema,
  pieceSchema,
} from "@/lib/model";
import { businessToday, canArchive } from "@/lib/workflow";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function authorised(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return { error: reply({ error: "Sign in to continue" }, 401) };
  const db = requestSupabase(token);
  if (!db)
    return { error: reply({ error: "Supabase has not been configured" }, 503) };
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    return {
      error: reply({ error: "Your session expired. Sign in again." }, 401),
    };
  const owner = await db
    .from("hs_owners")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (owner.error)
    return {
      error: reply(
        {
          error: "Database setup is incomplete. Apply the dashboard migration.",
        },
        503,
      ),
    };
  if (!owner.data)
    return {
      error: reply(
        { error: "This account is not an authorised Horizon owner." },
        403,
      ),
    };
  return { db };
}
function databaseError(error: { code?: string; message: string }) {
  if (error.code === "40001" || error.code === "23505")
    return reply(
      {
        error:
          "This record changed in another session. Reload the saved data before trying again; your unsaved edits are still on screen.",
      },
      409,
    );
  return reply(
    {
      error:
        "The database could not save or load this record. Check the migration and connection, then retry.",
    },
    500,
  );
}
export async function GET(req: NextRequest) {
  try {
    const auth = await authorised(req);
    if (auth.error) return auth.error;
    const { data, error } = await auth.db!.rpc("hs_load_workspace");
    if (error) return databaseError(error);
    if (!data) return reply({ error: "Owner access is required" }, 403);
    return reply(data);
  } catch {
    return reply(
      { error: "Unable to reach the data service. Please retry." },
      503,
    );
  }
}
const mutationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("event"), data: eventSchema }),
  z.object({ operation: z.literal("settings"), data: settingsSchema }),
  z.object({ operation: z.literal("musician"), data: musicianSchema }),
  z.object({ operation: z.literal("piece"), data: pieceSchema }),
  z.object({
    operation: z.literal("convertEnquiry"),
    data: z.object({ id: z.uuid() }),
  }),
]);
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (origin && origin !== req.nextUrl.origin)
      return reply({ error: "Request origin is not allowed" }, 403);
    const auth = await authorised(req);
    if (auth.error) return auth.error;
    const raw = await req.text();
    if (raw.length > 1000000)
      return reply({ error: "Record exceeds the one megabyte limit" }, 413);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return reply({ error: "Invalid request" }, 400);
    }
    const parsed = mutationSchema.safeParse(json);
    if (!parsed.success)
      return reply(
        {
          error: parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        400,
      );
    const { operation, data } = parsed.data;
    const db = auth.db!;
    if (operation === "event") {
      if (
        data.createdDate > businessToday() ||
        Object.values(data.milestones).some((d) => d > businessToday())
      )
        return reply(
          { error: "Completed actions cannot be dated in the future" },
          400,
        );
      if (data.archived) {
        const { data: s, error } = await db
          .from("hs_settings")
          .select("*")
          .eq("id", 1)
          .single();
        if (error) return databaseError(error);
        // Readiness is calculated as active; archived events intentionally have no queued actions.
        if (
          data.finance.depositReceived &&
          !canArchive({ ...data, archived: false }, settingsSchema.parse(s))
        )
          return reply(
            {
              error:
                "Resolve post-event actions before archiving a booked event.",
            },
            400,
          );
        if (!data.finance.depositReceived && !data.archiveReason.trim())
          return reply(
            { error: "Add the reason this enquiry did not proceed." },
            400,
          );
      }
      const { data: saved, error } = await db.rpc("hs_save_event", {
        p_event: data,
      });
      return error ? databaseError(error) : reply(saved);
    }
    if (operation === "settings") {
      const { data: saved, error } = await db.rpc("hs_save_settings", {
        p_settings: data,
      });
      return error ? databaseError(error) : reply(saved);
    }
    if (operation === "convertEnquiry") {
      const { data: saved, error } = await db.rpc(
        "hs_convert_website_enquiry",
        { p_id: data.id },
      );
      return error ? databaseError(error) : reply(saved);
    }
    const { data: saved, error } =
      operation === "musician"
        ? await db.from("hs_musicians").upsert(data).select().single()
        : await db.from("hs_pieces").upsert(data).select().single();
    return error ? databaseError(error) : reply(saved);
  } catch {
    return reply(
      {
        error:
          "Unable to complete the request. Your unsaved edits are still available.",
      },
      503,
    );
  }
}
