# Automatic website enquiries

Owner request: website enquiries should automatically become dashboard enquiries.

On owner sign-in, dashboard opening or explicit reload, the API calls
`hs_sync_and_load_workspace`. It converts submissions received from activation
onwards, then returns the updated workspace in one database transaction. The
existing converter carries contact details, preferred reply method, event date,
area, message, package and ensemble into a New Enquiry; the existing workflow
generates Respond to enquiry. It does not mark a reply or payment complete.

The original submission ID and row lock prevent duplicate conversion, including
manual conversion and concurrent owner sessions. Converted events are not updated
by later syncs, so owner edits and archived records are preserved. All pending
new submissions are processed, independently of the inbox's 100-row display limit.

Automatic creation happens on dashboard load, not in the background while it is
closed. No website code, submission function, email flow or service-role key changes
are required. If conversion fails, the sync transaction rolls back and dashboard
loading reports an error; the website submission remains saved for retry.

## Release

1. Verify the external production backup has completed successfully.
2. Check the live schema: the website enquiry inbox migration
   `202609230001_website_enquiry_inbox.sql` must already be applied. Do not blindly
   reapply historical migrations or overwrite newer live function definitions.
3. Apply `202610110001_automatic_website_enquiries.sql`, then deploy this dashboard
   commit. The activation timestamp is stored once; reapplying this migration
   does not reset it. Earlier submissions remain available for manual review,
   avoiding unexpected duplicates of historical manually entered records.
4. In production, use an explicitly labelled synthetic database enquiry (without
   sending an email), reload as an owner, verify one New Enquiry and its response
   task, edit it, and reload again to confirm no duplicate or overwritten edits.
   Verify anonymous and non-owner access remains denied.

Rollback: redeploy the previous application commit, which calls the read-only
workspace function. Keep the additive migration and existing linked records.
No deletion is required. Submissions received during rollback are caught up when
the new application is deployed again.

## Local verification (11 October 2026)

`npm run check` passed all 16 tests. The new embedded Postgres test verifies owner
access, activation timestamp preservation, earlier submissions left unconverted,
field mapping and the response action, repeated/manual conversion, preserved owner
edits and archived events, 101 pending submissions beyond the inbox display limit,
unknown event date/ensemble, and atomic rollback/retry on conversion failure.

`npm run build -- --webpack` passed. Default Turbopack could not resolve the shared
parent-directory dependencies in this isolated checkout; webpack used the same
installed dependency versions successfully. This is a local checkout limitation;
the deployed build must still be checked with its own installed dependencies.
Live activation and authenticated production smoke checks remain pending.
