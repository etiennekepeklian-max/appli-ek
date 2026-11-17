-- Additive, private audit history. No PIN, token, payload, memo or photo contents.
create table if not exists pikeo_private.activity_log (
 id bigint generated always as identity primary key,
 event_id uuid not null default gen_random_uuid(),
 profile_id uuid not null references pikeo_private.profiles(id),
 device_id uuid not null references pikeo_private.devices(id),
 action text not null check(length(action) between 1 and 80),
 source text not null check(source in ('server','client')),
 outcome text not null check(outcome in ('success','denied')),
 resource_type text, resource_id text,
 occurred_at timestamptz not null,
 received_at timestamptz not null default clock_timestamp(),
 unique(device_id,event_id)
);

create index if not exists activity_log_received on pikeo_private.activity_log(received_at desc);
create index if not exists activity_log_profile on pikeo_private.activity_log(profile_id,id desc);
alter table pikeo_private.activity_log enable row level security;
revoke all on pikeo_private.activity_log from public, anon, authenticated;
revoke all on sequence pikeo_private.activity_log_id_seq from public, anon, authenticated;

