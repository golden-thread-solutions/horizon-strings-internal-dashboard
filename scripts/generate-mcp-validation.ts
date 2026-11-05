import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  eventSchema,
  musicianSchema,
  pieceSchema,
  settingsSchema,
} from "../lib/model";

// Generate the SQL boundary's structural contract from the same model as readers.
// Zod custom refinements are enforced separately by assert_record in SQL.
export function databaseSchemas() {
  const event = z.toJSONSchema(eventSchema, { io: "input" });
  const directory = (schema: typeof musicianSchema | typeof pieceSchema) =>
    z.toJSONSchema(
      schema.extend({ revision: z.number().int().nonnegative() }),
      { io: "input" },
    );
  const date = (required = false) => ({
    type: "string",
    format: "horizon-date",
    minLength: required ? 10 : 0,
  });
  const p = event.properties! as Record<string, any>;
  p.eventDate = date();
  p.createdDate = date(true);
  for (const value of Object.values(p.details.properties) as any[])
    value.properties.dueDate = date();
  for (const key of Object.keys(p.milestones.properties))
    p.milestones.properties[key] = date();
  for (const key of ["depositDate", "finalDate"])
    p.finance.properties[key] = date();
  for (const [key, value] of Object.entries(p.finance.properties))
    if ((value as any).type === "number") (value as any).multipleOf = 0.01;
  p.tasks.items.properties.dueDate = date(true);
  p.tasks.items.properties.completedAt = date();
  p.communicationLog.items.properties.date = date(true);
  return {
    event,
    settings: z.toJSONSchema(settingsSchema),
    musician: directory(musicianSchema),
    piece: directory(pieceSchema),
  };
}

export function schemaSql() {
  const all = databaseSchemas();
  const supported = new Set([
    "$schema",
    "type",
    "properties",
    "required",
    "additionalProperties",
    "anyOf",
    "format",
    "pattern",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "const",
    "enum",
    "default",
    "maxItems",
    "propertyNames",
    "items",
    "multipleOf",
  ]);
  function check(schema: any) {
    for (const key of Object.keys(schema))
      if (!supported.has(key))
        throw new Error(
          `SQL validator does not support schema keyword: ${key}`,
        );
    for (const child of Object.values(schema.properties ?? {})) check(child);
    for (const child of schema.anyOf ?? []) check(child);
    for (const key of ["items", "propertyNames", "additionalProperties"])
      if (typeof schema[key] === "object") check(schema[key]);
  }
  Object.values(all).forEach(check);
  const schemas = JSON.stringify(all);
  return `-- BEGIN GENERATED RECORD SCHEMAS (node --import tsx scripts/generate-mcp-validation.ts)\ncreate function hs_mcp_private.record_schema(kind text) returns jsonb\nlanguage sql immutable set search_path='' as $schema$\n  select '${schemas.replaceAll("'", "''")}'::jsonb -> kind;\n$schema$;\n-- END GENERATED RECORD SCHEMAS`;
}

async function generate() {
  const file = new URL(
    "../supabase/migrations/20261029214158_horizon_readwrite_mcp.sql",
    import.meta.url,
  );
  const text = await readFile(file, "utf8");
  const next = text.replace(
    /-- BEGIN GENERATED RECORD SCHEMAS[\s\S]*?-- END GENERATED RECORD SCHEMAS/,
    schemaSql(),
  );
  if (next === text && !text.includes(schemaSql()))
    throw new Error("Missing SQL schema marker");
  await writeFile(file, next);
}
if (process.argv[1]?.endsWith("generate-mcp-validation.ts")) void generate();
