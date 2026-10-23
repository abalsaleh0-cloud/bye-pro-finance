# BYE PRO FINANCE

A secure, Arabic-first personal finance platform built around Supabase.

## Current foundation
- Supabase project: `ngfaukvfsesoslfiwaue` (EU West 3 / Paris)
- PostgreSQL schema with RLS-enabled finance tables
- Generated TypeScript database definitions
- React + TypeScript + Vite frontend foundation
- Private repository; never commit secrets or real financial data

## Requirements
- Node.js 20+
- npm 10+

## Setup
1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Run `npm install`.
4. Run `npm run dev`.

Do not put a Supabase service-role or secret key in any `VITE_*` variable.

## Planned monorepo evolution
- `apps/web`: responsive finance dashboard
- `apps/api`: trusted server-side operations where required
- `packages/finance-engine`: tested calculations and reporting rules
- `supabase/migrations`: database schema history
- `tests`: unit, integration, and browser tests

This repository is an initial scaffold, not yet a production-complete finance application.
