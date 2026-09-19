-- Applied after dashboard V1 for the owner's initial workflow choices.
-- Safe to run once in the existing Horizon Strings project.
begin;
update public.hs_settings
set "repertoireWeeks" = 8,
    "arrangementsWeeks" = 8,
    "rehearsalWeeks" = 4,
    "finalWeeks" = 4,
    "finalCheckWeeks" = 2,
    "postEventDays" = 3,
    "readyRequiresPayment" = false,
    "defaultsReviewed" = true,
    revision = revision + 1
where id = 1;
commit;
