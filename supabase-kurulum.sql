-- VARMEKS QC — Supabase kurulumu
-- Supabase panelinde: SQL Editor > New query > bu dosyanın tamamını yapıştır > Run

-- 1) Kontrol kartları (her kart bir satır, içeriği JSON)
create table if not exists public.qc_records (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- 2) Uygulama ayarları (tek satır)
create table if not exists public.qc_settings (
  id          int primary key default 1,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- 3) Geçmiş: her değişiklik ve silmede kartın ESKİ hâli burada saklanır
create table if not exists public.qc_history (
  hid         bigint generated always as identity primary key,
  record_id   text not null,
  op          text not null,          -- UPDATE / DELETE
  data        jsonb not null,
  changed_by  text,
  changed_at  timestamptz not null default now()
);
create index if not exists qc_history_rec on public.qc_history (record_id, changed_at desc);

create or replace function public.qc_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create or replace function public.qc_log() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.data is not distinct from new.data then return new; end if;
  insert into public.qc_history (record_id, op, data, changed_by)
  values (old.id, tg_op, old.data, coalesce(auth.jwt() ->> 'email', old.updated_by));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists qc_records_touch on public.qc_records;
create trigger qc_records_touch before update on public.qc_records for each row execute function public.qc_touch();
drop trigger if exists qc_records_log on public.qc_records;
create trigger qc_records_log after update or delete on public.qc_records for each row execute function public.qc_log();
drop trigger if exists qc_settings_touch on public.qc_settings;
create trigger qc_settings_touch before update on public.qc_settings for each row execute function public.qc_touch();

-- 4) Güvenlik: yalnızca giriş yapmış kullanıcılar okuyup yazabilir
alter table public.qc_records  enable row level security;
alter table public.qc_settings enable row level security;
alter table public.qc_history  enable row level security;

drop policy if exists "qc_records_auth" on public.qc_records;
create policy "qc_records_auth" on public.qc_records for all to authenticated using (true) with check (true);
drop policy if exists "qc_settings_auth" on public.qc_settings;
create policy "qc_settings_auth" on public.qc_settings for all to authenticated using (true) with check (true);
drop policy if exists "qc_history_read" on public.qc_history;
create policy "qc_history_read" on public.qc_history for select to authenticated using (true);

-- 5) Canlı güncelleme (bir cihazdaki değişiklik diğerlerine anında gelsin)
do $$ begin
  alter publication supabase_realtime add table public.qc_records;
exception when duplicate_object then null; end $$;

-- 6) Erişim izinleri (giriş yapmış kullanıcı; anonim erişim yok)
grant select, insert, update, delete on public.qc_records, public.qc_settings to authenticated;
grant select on public.qc_history to authenticated;
revoke all on public.qc_records, public.qc_settings, public.qc_history from anon;
