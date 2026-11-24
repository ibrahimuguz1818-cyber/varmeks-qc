-- VARMEKS QC — kullanıcı profilleri (ad, yetki, etkin/pasif)
-- Supabase → SQL Editor'de bir kez çalıştırılır. Tekrar çalıştırmak zararsızdır.

create table if not exists public.qc_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  ad          text not null default '',
  rol         text not null default 'kullanici' check (rol in ('yonetici','kullanici')),
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.qc_profiles enable row level security;
drop policy if exists "qc_profiles_read" on public.qc_profiles;
create policy "qc_profiles_read" on public.qc_profiles for select to authenticated using (true);
revoke all on public.qc_profiles from anon;
grant select on public.qc_profiles to authenticated;
-- Değişiklikler yalnızca qc-users sunucu fonksiyonu üzerinden (service role) yapılır.

-- Supabase panelinden eklenen kullanıcılar için de profil otomatik açılsın
create or replace function public.qc_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.qc_profiles (id, email, ad)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'ad', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists qc_on_auth_user on auth.users;
create trigger qc_on_auth_user after insert on auth.users for each row execute function public.qc_new_user();

-- Mevcut kullanıcılar için profil
insert into public.qc_profiles (id, email, ad)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- İlk yönetici: hesabı en eski olan kullanıcı (proje sahibi). Gerekirse e-postayı değiştirin.
update public.qc_profiles set rol = 'yonetici'
where id = (select id from auth.users order by created_at asc limit 1)
  and not exists (select 1 from public.qc_profiles where rol = 'yonetici');

select p.email, p.ad, p.rol, u.created_at, u.last_sign_in_at
from public.qc_profiles p join auth.users u on u.id = p.id order by u.created_at;
