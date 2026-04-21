# pomarado-

Supabase-powered Pomodoro dashboard with:

- Email/password authentication
- Cloud sync for sessions, daily stats, streak, settings, tasks
- Row Level Security (RLS) for per-user data isolation

## 1) Configure Supabase Keys

Edit [db.js](db.js) and set:

- `supabaseUrl`
- `supabaseAnonKey`

You can also define:

```html
<script>
window.__SUPABASE_CONFIG = {
	supabaseUrl: "https://YOUR_PROJECT_ID.supabase.co",
	supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY"
};
</script>
```

before loading [db.js](db.js).

## 2) Create Tables

Run in Supabase SQL editor:

```sql
create table if not exists public.user_stats (
	user_id uuid primary key references auth.users(id) on delete cascade,
	total_sessions integer not null default 0,
	total_focus_minutes integer not null default 0,
	daily_stats jsonb not null default '{}'::jsonb,
	streak jsonb not null default '{"lastActiveDate":null,"currentStreak":0,"bestStreak":0}'::jsonb,
	settings jsonb not null default '{}'::jsonb,
	timer_state jsonb,
	notes jsonb not null default '[]'::jsonb,
	music jsonb not null default '{"lastTrackIndex":0,"lastVolume":0.7}'::jsonb,
	updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
	id text primary key,
	user_id uuid not null references auth.users(id) on delete cascade,
	text text not null,
	completed boolean not null default false,
	created_at timestamptz not null default now()
);
```

## 3) Enable RLS and Policies

```sql
alter table public.user_stats enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "user_stats_select_own" on public.user_stats;
create policy "user_stats_select_own"
on public.user_stats for select
using (auth.uid() = user_id);

drop policy if exists "user_stats_insert_own" on public.user_stats;
create policy "user_stats_insert_own"
on public.user_stats for insert
with check (auth.uid() = user_id);

drop policy if exists "user_stats_update_own" on public.user_stats;
create policy "user_stats_update_own"
on public.user_stats for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
on public.tasks for select
using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
on public.tasks for insert
with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
on public.tasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
on public.tasks for delete
using (auth.uid() = user_id);
```

## 4) Run

Open [index.html](index.html) in a browser after setting Supabase keys.