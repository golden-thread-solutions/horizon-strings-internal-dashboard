# V2 / Future Architecture

Deferred ideas:

- Supabase database connection from the app
- Vercel production deployment with real environment variables
- administrator login
- configurable roles and permissions
- client portal
- musician portal
- Gmail draft generation
- Google Calendar integration
- invoicing/accounting integration
- payment reconciliation
- configurable workflow builder
- configurable custom fields
- multi-business reusable dashboard framework

## Important Future Constraint

Do not make the Horizon-specific UI generic too early. Keep the underlying model reusable, but make Horizon v1 genuinely useful first.

## Future Workflow Builder Concept

Possible structure:

State -> Requirements -> Actions/Triggers -> Next State

This should not be implemented in v0.5.
