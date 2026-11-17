-- Additive private tables. No browser role receives direct access.
create table if not exists pikeo_private.native_devices (
 device_id uuid primary key references pikeo_private.devices(id),
 public_key text not null, fingerprint text not null,
 approved boolean not null default false, created_at timestamptz not null default now(),
 approved_at timestamptz, approved_by uuid references pikeo_private.devices(id)
);
create table if not exists pikeo_private.platform_policy(id boolean primary key default true check(id),web_admin_only boolean not null default false);
insert into pikeo_private.platform_policy(id) values(true) on conflict do nothing;
create table if not exists pikeo_private.management_access (
 profile_id uuid primary key references pikeo_private.profiles(id),modules text[] not null default '{}',updated_at timestamptz not null default now()
);
create table if not exists pikeo_private.management_records (
 id uuid primary key,kind text not null,data jsonb not null,version integer not null default 1,
 created_by uuid not null references pikeo_private.profiles(id),updated_by uuid not null references pikeo_private.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted boolean not null default false
);
create index if not exists management_records_kind on pikeo_private.management_records(kind,updated_at desc);
create table if not exists pikeo_private.management_files (
 id uuid primary key,record_id uuid not null references pikeo_private.management_records(id),name text not null,mime text not null,bytes bytea not null,
 created_by uuid not null references pikeo_private.profiles(id),created_at timestamptz not null default now()
);
alter table pikeo_private.native_devices enable row level security;
alter table pikeo_private.platform_policy enable row level security;
alter table pikeo_private.management_access enable row level security;
alter table pikeo_private.management_records enable row level security;
alter table pikeo_private.management_files enable row level security;
revoke all on pikeo_private.native_devices,pikeo_private.platform_policy,pikeo_private.management_access,pikeo_private.management_records,pikeo_private.management_files from public,anon,authenticated;
