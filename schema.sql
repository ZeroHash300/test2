-- =====================================================================
-- Leaderboard Aldervane - skema database (Supabase / PostgreSQL)
-- Jalankan seluruh isi file ini di Supabase: SQL Editor -> New query -> Run
-- =====================================================================

-- ---------- Tabel ----------
create table if not exists public.players (
  uid         text primary key check (length(trim(uid)) > 0),
  name        text not null check (length(trim(name)) > 0),
  score       integer not null default 0 check (score >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.score_log (
  id         bigint generated always as identity primary key,
  uid        text not null,
  name       text,
  old_score  integer,
  new_score  integer,
  action     text not null check (action in ('create', 'update', 'delete')),
  actor      uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- Fungsi bantu ----------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Rentang rank. Jika diubah, ubah juga RANKS di src/shared.js.
create or replace function public.rank_of(s integer)
returns text
language sql immutable
as $$
  select case
    when s >= 7500 then 'praefect'
    when s >= 3250 then 'sentinel'
    when s >= 200  then 'knight'
    else null
  end;
$$;

-- ---------- Trigger: updated_at + riwayat perubahan ----------
create or replace function public.players_audit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into score_log (uid, name, old_score, new_score, action)
    values (new.uid, new.name, null, new.score, 'create');
    return new;
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
    if new.score is distinct from old.score or new.name is distinct from old.name then
      insert into score_log (uid, name, old_score, new_score, action)
      values (new.uid, new.name, old.score, new.score, 'update');
    end if;
    return new;
  else
    insert into score_log (uid, name, old_score, new_score, action)
    values (old.uid, old.name, old.score, null, 'delete');
    return old;
  end if;
end;
$$;

drop trigger if exists players_audit on public.players;
create trigger players_audit
  before insert or update or delete on public.players
  for each row execute function public.players_audit();

-- ---------- Row Level Security ----------
alter table public.players   enable row level security;
alter table public.admins    enable row level security;
alter table public.score_log enable row level security;

drop policy if exists "admin kelola players" on public.players;
create policy "admin kelola players" on public.players
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin baca log" on public.score_log;
create policy "admin baca log" on public.score_log
  for select to authenticated
  using (public.is_admin());

-- Tabel admins sengaja tanpa policy: tidak bisa diakses lewat API.

-- ---------- Fungsi publik untuk website leaderboard ----------
-- Hanya mengembalikan nama, poin, dan posisi. UID tidak pernah dikirim ke publik.

-- Top 10 tiap rank
create or replace function public.get_leaderboard()
returns table (rank_id text, pos integer, name text, score integer, total integer)
language sql stable security definer
set search_path = public
as $$
  with r as (
    select
      p.name,
      p.score,
      rank_of(p.score) as rank_id,
      row_number() over (partition by rank_of(p.score) order by p.score desc, p.name asc, p.uid asc) as pos,
      count(*)     over (partition by rank_of(p.score)) as total
    from players p
    where p.score >= 200
  )
  select r.rank_id, r.pos::int, r.name, r.score, r.total::int
  from r
  where r.pos <= 10
  order by r.rank_id, r.pos;
$$;

-- Cari satu pemain berdasarkan UID
create or replace function public.lookup_player(p_uid text)
returns table (name text, score integer, rank_id text, pos integer, total integer)
language sql stable security definer
set search_path = public
as $$
  with r as (
    select
      p.uid,
      p.name,
      p.score,
      rank_of(p.score) as rank_id,
      row_number() over (partition by rank_of(p.score) order by p.score desc, p.name asc, p.uid asc) as pos,
      count(*)     over (partition by rank_of(p.score)) as total
    from players p
  )
  select
    r.name,
    r.score,
    r.rank_id,
    case when r.rank_id is null then null else r.pos::int end,
    case when r.rank_id is null then null else r.total::int end
  from r
  where r.uid = trim(p_uid)
  limit 1;
$$;

-- ---------- Fungsi khusus admin ----------
-- Tambah/kurangi poin (delta boleh negatif). Poin tidak akan di bawah 0.
create or replace function public.adjust_score(p_uid text, p_delta integer)
returns integer
language plpgsql security invoker
set search_path = public
as $$
declare
  v integer;
begin
  update players
     set score = greatest(0, score + p_delta)
   where uid = trim(p_uid)
   returning score into v;
  return v;  -- null jika UID tidak ditemukan
end;
$$;

-- ---------- Hak akses fungsi ----------
revoke all on function public.get_leaderboard()          from public;
revoke all on function public.lookup_player(text)        from public;
revoke all on function public.adjust_score(text, integer) from public;
revoke all on function public.is_admin()                 from public;

grant execute on function public.get_leaderboard()           to anon, authenticated;
grant execute on function public.lookup_player(text)         to anon, authenticated;
grant execute on function public.adjust_score(text, integer) to authenticated;
grant execute on function public.is_admin()                  to authenticated;

-- ---------- Menjadikan akun sebagai admin ----------
-- 1) Buat user di Authentication -> Users (Add user, isi email & password).
-- 2) Jalankan query ini (ganti emailnya):
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'emailkamu@example.com';
