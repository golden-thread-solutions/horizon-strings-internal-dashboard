# Horizon Strings Operations Platform - v0.5 Architecture

## Purpose

This local prototype turns the existing Horizon Strings spreadsheet system into a clickable operations dashboard.

The goal is not to replace the full business system yet. The goal is to prove the data model, workflow, event page layout, and action surfaces before committing to Supabase and Vercel.

## Current Stack

- Next.js local app
- File-based local data in `data/horizon.ts`
- Business rules in `lib/workflow.ts`
- Supabase schema prepared, but not connected yet
- Vercel deployment path prepared, but not deployed yet
- Optional simple password protection through `DASHBOARD_PASSWORD`

## Conceptual Flow

User -> dashboard page -> workflow rules -> local event data -> visible result

For v0.5, edits are not persisted to a real database. This is intentional. We are avoiding a hard database commitment until the operational model is approved.

## Online v0.5 Flow

For the first online test, the recommended flow is:

User -> Vercel dashboard -> optional password gate -> local dashboard data -> visible result

This proves GitHub and Vercel without exposing real customer data or forcing the database connection too early.

## Supabase v1 Flow

Once the Vercel deployment works, the next flow should be:

User -> Vercel dashboard -> optional password gate -> server-side app logic -> Supabase PostgreSQL -> visible result

The Supabase service role key must stay server-side. Do not expose it in browser code.

## Source Material Used

- Horizon Strings website brief as business context only
- Current Google Sheet: `Event Details`
- Current Google Doc: Important doc
- Pasted Apps Script source

## Event Details Mapping

The live `Event Details` workbook has now been read directly and mapped into CRM concepts.

Key tabs inspected:

- `Clients`
- `Client Sheet Template`
- client event tabs such as `Sample Client - E9001`
- `Tasks`
- `Finance`
- `Musicians`
- `Arrangements`
- `Settings`
- `Task Rules`
- `Template Map`
- hidden structured tabs such as `Event Overview`, `Client Tasks`, `Client progression`, `Event timing`, `Event logistics`, `Contact details`, and `Event repertoire`

The detailed mapping is documented in:

`docs/sheet-crm-mapping.md`

## Apps Script Logic Preserved Conceptually

The script currently manages:

- new client sheet creation
- event IDs
- client index rows
- current vs archived client sheets
- hub refreshes for finance, musicians, pending tasks, and pending arrangements
- formatting rules for N/A and missing fields

In the web app, these become normal app views and rules rather than manual refresh buttons.
