# External production database backups

The production database is backed up independently of Supabase through GitHub Actions to a private Cloudflare R2 bucket. The workflow runs at 17 minutes past every sixth hour and can also be started with **Actions → External database backup → Run workflow**.

Each run uses PostgreSQL-native tools against the production connection string:

- `pg_dump` creates a custom-format database dump containing the schema, data, functions, triggers, views, indexes, constraints, sequences and RLS policies.
- `pg_dumpall --roles-only --no-role-passwords` records recreatable role definitions without exporting password hashes.
- A metadata file records the timestamp, production project reference, format, workflow version and Git SHA.
- The archive is gzip-compressed, encrypted with `age` using a GitHub Secret, and accompanied by a SHA-256 file.
- The encrypted archive and checksum are uploaded beneath `production/database/YYYY/MM/` in the private R2 bucket.
- The workflow checks the uploaded size and downloads the remote checksum before retention cleanup. Cleanup runs only after the new upload and verification succeed and retains approximately 30 days.

Required GitHub Actions secrets for the dashboard repository:

| Secret                  | Value                                                                            |
| ----------------------- | -------------------------------------------------------------------------------- |
| `SUPABASE_DB_URL`       | Production PostgreSQL connection string from Supabase; keep the password private |
| `R2_ENDPOINT`           | Cloudflare R2 S3 API endpoint for the backup account                             |
| `R2_BUCKET`             | Dedicated private backup bucket name                                             |
| `R2_ACCESS_KEY_ID`      | Least-privilege R2 access key                                                    |
| `R2_SECRET_ACCESS_KEY`  | Matching R2 secret key                                                           |
| `BACKUP_ENCRYPTION_KEY` | Long random passphrase kept in the owner's password manager and GitHub Secret    |

The repository workflow is present but does not run successfully until these values and the private bucket exist. It never writes backup files to the repository. Production and development/test must use different connection strings and bucket prefixes; only the production workflow is included in V1.

Do not put these values in the repository, Vercel, the dashboard environment, issues or workflow logs. The application does not use Supabase Storage for contracts, invoices, uploads or other business files in V1, so this workflow covers the current database only. If Storage files are added later, create a separate object-backup workflow under a different R2 prefix.

## Recovery

1. Stop writes to the dashboard and identify a verified `.tar.gz.age` object and its `.sha256` sidecar in R2.
2. Download both objects to a private recovery machine and compare the sidecar with a local `sha256sum` result.
3. Decrypt with the retained `BACKUP_ENCRYPTION_KEY` using `age --decrypt --passphrase-file`.
4. Extract the archive. Restore roles first where applicable, then use `pg_restore` for `production.dump` into a new test or replacement Supabase database.
5. Run the dashboard migration verification and the live smoke checks against the restored project. Confirm functions, triggers, RLS, relationships and sample records before changing Vercel's Supabase URL/key.

The first restore must be performed manually into a separate test database and recorded. Repeat a restore test at least monthly. A successful upload alone is not evidence that recovery works.

For a one-off, non-destructive check before a full restore is practical, run the **Verify latest encrypted database backup** workflow manually. It downloads the newest archive from R2, checks its checksum, decrypts it only in the temporary GitHub runner, and validates the contained PostgreSQL dump without connecting to or changing any database. It is not scheduled.
