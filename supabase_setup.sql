-- EXTENDED SUPABASE SETUP FOR PRODUCTIVITY DASHBOARD

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  bio text,
  college text
);

-- 2. PROJECTS TABLE
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  progress int default 0
);

-- 3. MILESTONES TABLE
create table if not exists public.milestones (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  completed boolean default false
);

-- 4. SUBJECTS TABLE
create table if not exists public.subjects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  total_units int default 0,
  completed_units int default 0
);

-- 5. HEALTH LOGS TABLE
create table if not exists public.health_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  water int default 0,
  sleep_hours float default 0
);

-- ENABLE ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.subjects enable row level security;
alter table public.health_logs enable row level security;

-- POLICIES FOR PROFILES
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- POLICIES FOR PROJECTS
create policy "projects_select_own" on public.projects for select using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects for delete using (auth.uid() = user_id);

-- POLICIES FOR MILESTONES
create policy "milestones_select_own" on public.milestones for select using (auth.uid() = user_id);
create policy "milestones_insert_own" on public.milestones for insert with check (auth.uid() = user_id);
create policy "milestones_update_own" on public.milestones for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "milestones_delete_own" on public.milestones for delete using (auth.uid() = user_id);

-- POLICIES FOR SUBJECTS
create policy "subjects_select_own" on public.subjects for select using (auth.uid() = user_id);
create policy "subjects_insert_own" on public.subjects for insert with check (auth.uid() = user_id);
create policy "subjects_update_own" on public.subjects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subjects_delete_own" on public.subjects for delete using (auth.uid() = user_id);

-- POLICIES FOR HEALTH LOGS
create policy "health_logs_select_own" on public.health_logs for select using (auth.uid() = user_id);
create policy "health_logs_insert_own" on public.health_logs for insert with check (auth.uid() = user_id);
create policy "health_logs_update_own" on public.health_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
