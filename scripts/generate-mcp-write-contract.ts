import { readFile, writeFile } from "node:fs/promises";
import { databaseCommandSchemas } from "../lib/mcp/commands";
export const migration = new URL(
  "../supabase/migrations/20261105221834_authenticated_mcp_writes.sql",
  import.meta.url,
);
export function contractSql() {
  return `-- BEGIN GENERATED COMMAND CONTRACT\ncreate function hs_mcp_private.command_contract() returns jsonb\nlanguage sql immutable set search_path='' as $contract$\nselect '${JSON.stringify(databaseCommandSchemas()).replaceAll("'", "''")}'::jsonb;\n$contract$;\n-- END GENERATED COMMAND CONTRACT`;
}
async function main() {
  if (process.argv.includes("--write")) {
    const source = await readFile(migration, "utf8");
    await writeFile(
      migration,
      source.replace(
        /-- BEGIN GENERATED COMMAND CONTRACT[\s\S]*?-- END GENERATED COMMAND CONTRACT/,
        contractSql(),
      ),
    );
  }
}
void main();
