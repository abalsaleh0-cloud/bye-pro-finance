# Supabase

- Project ref: `ngfaukvfsesoslfiwaue`
- Region: EU West 3 (Paris)
- Keep database migrations versioned in `supabase/migrations/`.
- Regenerate `src/types/database.types.ts` whenever the public schema changes.
- Keep Storage private and retain RLS on every exposed table.
- Never commit access tokens, service-role keys, secret keys, or user finance data.

The database already contains the initial finance schema. The migration history should be reconciled with the live project before applying any further migrations; do not blindly replay schema creation against the existing project.
