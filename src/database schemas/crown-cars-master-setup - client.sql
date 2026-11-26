-- ============================================================
-- CROWN CARS — TRANSPORT MANAGEMENT SYSTEM
-- MASTER DATABASE SETUP SCRIPT (COMBINED — v2)
-- Replaces both crown-cars-master-setup.sql + crown-cars-additions.sql
-- Run this ONCE in a fresh Supabase project for each new client
-- Last updated: May 2026
-- ============================================================

-- ============================================================
-- 1. TABLES
-- All foreign keys use ON DELETE SET NULL to prevent data loss
-- if an auth user is accidentally deleted
-- ============================================================

-- ── ROUTES ──────────────────────────────────────────────────
create table public.routes (
  id                  text primary key,
  user_id             uuid references auth.users(id) on delete set null,
  number              text,
  name                text,
  po_number           text,
  school              text,
  primary_driver_id   text,
  primary_pa_id       text,
  daily_rate          numeric default 0,
  driver_daily_rate   numeric default 0,
  pa_daily_rate       numeric default 0,
  pa_pay_rate         numeric default 0,
  rate_bands          jsonb default '[]',
  operational_days    jsonb default '[1,2,3,4,5]',
  active              boolean default true,
  suspended           boolean default false,
  contract_start      text,
  contract_end        text,
  documents           jsonb default '[]',
  notes               text,
  created_at          bigint
);

-- ── INVOICES ────────────────────────────────────────────────
create table public.invoices (
  id                  text primary key,
  user_id             uuid references auth.users(id) on delete set null,
  invoice_number      text,
  po_number           text,
  invoice_date        text,
  month               integer,
  year                integer,
  route_number        text,
  route_name          text,
  days_worked         numeric default 0,
  unit_price          numeric default 0,
  net_total           numeric default 0,
  vat                 numeric default 0,
  total               numeric default 0,
  status              text default 'unpaid',
  paid_amount         numeric default 0,
  remittance_id       text,
  file_name           text,
  is_revised          boolean default false,
  revised_by          text,
  revision_note       text,
  original_invoice_id text,
  notes               text default '',
  created_at          bigint
);

-- ── STAFF ───────────────────────────────────────────────────
create table public.staff (
  id            text primary key,
  user_id       uuid references auth.users(id) on delete set null,
  name          text,
  short_name    text,
  type          text,
  phone         text,
  email         text,
  date_of_birth text,
  nationality   text,
  status        text default 'active',
  address       text,
  bank_name     text,
  account_no    text,
  sort_code     text,
  notes         text,
  documents     jsonb default '[]',
  created_at    bigint
);

-- ── PAYMENTS ────────────────────────────────────────────────
create table public.payments (
  id              text primary key,
  user_id         uuid references auth.users(id) on delete set null,
  staff_id        text,
  amount          numeric,
  date            text,
  type            text,
  month           integer,
  year            integer,
  reference       text,
  notes           text,
  allocation_ids  jsonb default '[]',
  period_month    integer,
  period_year     integer,
  is_external     boolean default false,
  external_name   text,
  created_at      bigint
);

-- ── REMITTANCES ─────────────────────────────────────────────
create table public.remittances (
  id             text primary key,
  user_id        uuid references auth.users(id) on delete set null,
  payment_number text,
  total          numeric,
  payment_date   text,
  items          jsonb,
  file_name      text,
  created_at     bigint
);

-- ── SETTINGS ────────────────────────────────────────────────
create table public.settings (
  id      text primary key,
  user_id uuid references auth.users(id) on delete set null,
  data    jsonb
);

-- ── ALLOCATIONS ─────────────────────────────────────────────
create table public.allocations (
  id               text primary key,
  user_id          uuid references auth.users(id) on delete set null,
  route_id         text,
  route_number     text,
  route_name       text,
  month            integer,
  year             integer,
  total_days       integer default 0,
  regular_staff_id text,
  regular_days     integer default 0,
  regular_rate     numeric default 0,
  regular_amount   numeric default 0,
  temp_staff_id    text,
  temp_staff_name  text,
  temp_days        integer default 0,
  temp_rate        numeric default 0,
  temp_amount      numeric default 0,
  cover_entries    jsonb default '[]',
  absence_reason   text,
  notes            text,
  created_at       bigint
);

-- ── PO HISTORY ──────────────────────────────────────────────
create table public.po_history (
  id           text primary key,
  user_id      uuid references auth.users(id) on delete set null,
  route_id     text,
  route_number text,
  po_number    text,
  start_date   text,
  end_date     text,
  notes        text,
  created_at   bigint
);

-- ── AUDIT LOG ───────────────────────────────────────────────
create table public.audit_log (
  id           text primary key,
  user_id      uuid references auth.users(id) on delete set null,
  action       text,
  entity       text,
  entity_id    text,
  entity_label text,
  changes      jsonb,
  created_at   bigint
);

-- ── CHILDREN ────────────────────────────────────────────────
create table public.children (
  id                text primary key,
  user_id           uuid references auth.users(id) on delete set null,
  route_id          text,
  route_number      text,
  first_name        text,
  last_name         text,
  date_of_birth     text,
  school_name       text,
  school_address    text,
  travel_days       jsonb default '[1,2,3,4,5]',
  am_pickup_time    text,
  pm_pickup_time    text,
  pickup_addresses  jsonb default '[]',
  dropoff_address   text,
  am_only           boolean default false,
  pm_only           boolean default false,
  afterschool_clubs jsonb default '[]',
  requires_pa       boolean default false,
  pa_requirements   text,
  parent_contacts   jsonb default '[]',
  care_plan_notes   text,
  medical_notes     text,
  status            text default 'active',
  start_date        text,
  end_date          text,
  documents         jsonb default '[]',
  notes             text,
  created_at        bigint
);

-- ── ATTENDANCE ──────────────────────────────────────────────
create table public.attendance (
  id                   text primary key,
  user_id              uuid references auth.users(id) on delete set null,
  month                integer,
  year                 integer,
  date                 text,
  route_id             text,
  route_number         text,
  status               text default 'ran',
  days_value           numeric default 1,
  is_split_run         boolean default false,
  am_driver_id         text,
  am_driver_name       text,
  pm_driver_id         text,
  pm_driver_name       text,
  am_pa_id             text,
  am_pa_name           text,
  pm_pa_id             text,
  pm_pa_name           text,
  driver_id            text,
  driver_name          text,
  is_cover_driver      boolean default false,
  is_external_driver   boolean default false,
  external_driver_name text,
  is_external_pa       boolean default false,
  external_pa_name     text,
  pa_id                text,
  pa_name              text,
  is_cover_pa          boolean default false,
  children_attendance  jsonb default '[]',
  no_run_reason        text,
  notes                text,
  created_at           bigint
);

create index if not exists attendance_month_year
  on public.attendance(user_id, year, month);

-- ── SCHOOL HOLIDAYS ─────────────────────────────────────────
create table public.school_holidays (
  id         text primary key,
  user_id    uuid references auth.users(id) on delete set null,
  date       text,
  label      text,
  type       text,
  all_routes boolean default true,
  route_ids  jsonb default '[]',
  month      integer,
  year       integer,
  created_at bigint
);

-- ── STAFF LICENCES (compliance) ─────────────────────────────
create table public.staff_licences (
  id                     text primary key,
  user_id                uuid references auth.users(id) on delete set null,
  staff_id               text,
  authority              text,
  driver_licence_number  text,
  driver_licence_expiry  text,
  vehicle_make           text,
  vehicle_model          text,
  vehicle_colour         text,
  vehicle_registration   text,
  vehicle_licence_number text,
  vehicle_licence_expiry text,
  insurance_expiry       text,
  documents              jsonb default '[]',
  notes                  text,
  created_at             bigint
);

-- ── STAFF TRAINING (compliance) ─────────────────────────────
create table public.staff_training (
  id              text primary key,
  user_id         uuid references auth.users(id) on delete set null,
  staff_id        text,
  training_type   text,
  renewal_years   integer default 3,
  completed_date  text,
  expiry_date     text,
  certificate_url text,
  notes           text,
  created_at      bigint
);

-- ── STAFF PORTAL TOKENS (driver invoice portal) ─────────────
create table public.staff_portal_tokens (
  id         text primary key,
  user_id    uuid references auth.users(id) on delete set null,
  staff_id   text,
  staff_name text,
  token      text unique,
  active     boolean default true,
  created_at bigint
);

-- ── STAFF INVOICE SUBMISSIONS (driver portal) ───────────────
create table public.staff_invoice_submissions (
  id               text primary key,
  user_id          uuid references auth.users(id) on delete set null,
  token_id         text,
  staff_id         text,
  staff_name       text,
  month            integer,
  year             integer,
  route_entries    jsonb default '[]',
  cover_entries    jsonb default '[]',
  days_confirmed   numeric,
  invoice_number   text,
  invoice_amount   numeric,
  period_from      text,
  period_to        text,
  signature_name   text,
  signature_date   text,
  notes            text,
  status           text default 'submitted',
  submitted_at     bigint,
  approved_at      bigint,
  payment_id       text,
  created_at       bigint
);

-- ── STAFF APPLICATIONS (public application form) ────────────
create table public.staff_applications (
  id                    text primary key,
  target_user_id        uuid references auth.users(id) on delete set null,
  position_type         text,
  full_name             text,
  email                 text,
  phone                 text,
  current_address       text,
  previous_address      text,
  ni_number             text,
  nationality           text,
  has_uk_driving_licence boolean default false,
  requires_work_permit  boolean default false,
  work_permit_number    text,
  work_permit_doc_url   text,
  has_convictions       boolean default false,
  conviction_details    text,
  dbs_registered        boolean default false,
  dbs_name              text,
  dbs_dob               text,
  dbs_cert_number       text,
  dbs_update_id         text,
  applicant_refs        jsonb default '[]',
  declaration_agreed    boolean default false,
  declaration_name      text,
  declaration_date      text,
  status                text default 'pending',
  admin_notes           text,
  created_at            bigint
);

-- ── WORKSPACE MEMBERS (multi-user access) ───────────────────
-- Note: CASCADE is intentional here — if either user is deleted,
-- the membership row should also be removed
create table public.workspace_members (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid references auth.users(id) on delete cascade,
  member_email   text not null,
  role           text default 'member',
  created_at     bigint,
  unique(owner_user_id, member_email)
);


-- ============================================================
-- 2. ROW LEVEL SECURITY — ENABLE ON ALL TABLES
-- ============================================================

alter table public.routes                    enable row level security;
alter table public.invoices                  enable row level security;
alter table public.staff                     enable row level security;
alter table public.payments                  enable row level security;
alter table public.remittances               enable row level security;
alter table public.settings                  enable row level security;
alter table public.allocations               enable row level security;
alter table public.po_history                enable row level security;
alter table public.audit_log                 enable row level security;
alter table public.children                  enable row level security;
alter table public.attendance                enable row level security;
alter table public.school_holidays           enable row level security;
alter table public.staff_licences            enable row level security;
alter table public.staff_training            enable row level security;
alter table public.staff_portal_tokens       enable row level security;
alter table public.staff_invoice_submissions enable row level security;
alter table public.staff_applications        enable row level security;
alter table public.workspace_members         enable row level security;


-- ============================================================
-- 3. WORKSPACE MEMBER HELPER FUNCTION
-- Returns true if the calling user is a member of owner_id's workspace
-- Used by all RLS policies below
-- ============================================================

create or replace function public.is_workspace_member(owner_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where owner_user_id = owner_id
    and member_email = (auth.jwt() ->> 'email')
  );
$$;

-- ============================================================
-- 4. RLS POLICIES
-- Single "data_access" policy per table covers all operations.
-- This avoids the policy conflict bug caused by multiple
-- overlapping policies (select/insert/update/delete separately).
-- ============================================================

-- ── Data tables (owner + workspace member) ──────────────────

create policy "data_access" on public.routes
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.invoices
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.staff
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.payments
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.remittances
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.settings
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.allocations
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.po_history
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.audit_log
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.children
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.attendance
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.school_holidays
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.staff_licences
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

create policy "data_access" on public.staff_training
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

-- ── Staff portal tokens ─────────────────────────────────────
create policy "data_access" on public.staff_portal_tokens
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

-- Anon can read active tokens (needed to validate portal links)
create policy "anon_select" on public.staff_portal_tokens
  for select to anon using (true);

-- ── Staff invoice submissions ────────────────────────────────
create policy "data_access" on public.staff_invoice_submissions
  for all to authenticated
  using (user_id = auth.uid() or is_workspace_member(user_id))
  with check (user_id = auth.uid() or is_workspace_member(user_id));

-- Anon can submit invoices via staff portal
create policy "anon_insert" on public.staff_invoice_submissions
  for insert to anon with check (true);

-- Anon can view their own submission via active token
create policy "anon_select_by_token" on public.staff_invoice_submissions
  for select to anon
  using (token_id in (
    select id from public.staff_portal_tokens where active = true
  ));

-- Anon can recall (update status) their own recalled submission
create policy "anon_update_recalled" on public.staff_invoice_submissions
  for update to anon
  using (status = 'recalled') with check (true);

-- ── Staff applications ───────────────────────────────────────
-- Uses target_user_id instead of user_id
create policy "data_access" on public.staff_applications
  for all to authenticated
  using (target_user_id = auth.uid() or is_workspace_member(target_user_id))
  with check (target_user_id = auth.uid() or is_workspace_member(target_user_id));

-- Anon can submit applications via public /apply form
create policy "anon_insert" on public.staff_applications
  for insert to anon with check (true);

-- ── Workspace members ────────────────────────────────────────
-- Owner has full control over their workspace
create policy "owner_manage" on public.workspace_members
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Members can read their own membership row (needed on login to resolve workspace)
create policy "member_read" on public.workspace_members
  for select to authenticated
  using (member_email = (auth.jwt() ->> 'email'));

-- Anon can check if an email is already a member (used on /signup)
create policy "anon_check" on public.workspace_members
  for select to anon using (true);



-- ============================================================
-- add new columns for PA rates in routes table
alter table public.routes add column if not exists pa_daily_rate numeric default 0;
alter table public.routes add column if not exists pa_pay_rate numeric default 0;


-- ============================================================
-- 5. ANON GRANTS
-- Required for public-facing forms: /apply and staff portal
-- ============================================================

grant usage on schema public to anon;
grant select          on public.staff_portal_tokens       to anon;
grant insert          on public.staff_invoice_submissions to anon;
grant select          on public.staff_invoice_submissions to anon;
grant update          on public.staff_invoice_submissions to anon;
grant insert          on public.staff_applications        to anon;
grant select          on public.workspace_members         to anon;

-- ============================================================
-- 6. REALTIME
-- Enables live updates for admin when drivers submit invoices
-- or applicants submit applications
-- ============================================================

alter publication supabase_realtime add table public.staff_invoice_submissions;
alter publication supabase_realtime add table public.staff_applications;

alter table public.routes 
add column if not exists rate_bands jsonb default '[]'::jsonb;

alter table public.allocations
  add column if not exists pa_staff_id text default null,
  add column if not exists pa_staff_name text default null,
  add column if not exists pa_days numeric default 0,
  add column if not exists pa_rate numeric default 0,
  add column if not exists pa_amount numeric default 0;

  alter table public.allocations
  add column if not exists additive_entries jsonb default '[]'::jsonb;

  alter table public.allocations
  add column if not exists has_rate_split boolean default false;

  -- Drop if partially created from failed previous run
drop table if exists public.billing_recipients cascade;

-- Recreate with owner field (matches other tables pattern)
create table if not exists public.billing_recipients (
  id                   uuid primary key default gen_random_uuid(),
  owner_user_id        uuid references auth.users(id) on delete cascade,
  name                 text not null,
  address              text default '',
  email                text default '',
  phone                text default '',
  supplier_ref         text default '',
  is_default           boolean default false,
  active               boolean default true,
  last_invoice_number  integer default 0,
  notes                text default '',
  created_at           bigint
);

alter table public.billing_recipients enable row level security;

create policy "workspace_access" on public.billing_recipients
for all using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.workspace_members wm
    where wm.owner_user_id = billing_recipients.owner_user_id
    and wm.member_user_id = auth.uid()
  )
);

-- Tag routes with client (UI to assign comes in Phase 2)
alter table public.routes
  add column if not exists client_id uuid
  references public.billing_recipients(id)
  on delete set null;

-- Tag invoices with client
alter table public.invoices
  add column if not exists client_id uuid
  references public.billing_recipients(id)
  on delete set null;

  alter table public.billing_recipients
  add column if not exists short_name text default '';

  -- Drop existing foreign key constraints
alter table public.routes drop constraint if exists routes_client_id_fkey;
alter table public.invoices drop constraint if exists invoices_client_id_fkey;

-- Convert id types to text
alter table public.billing_recipients alter column id type text;
alter table public.routes alter column client_id type text;
alter table public.invoices alter column client_id type text;

-- Re-add foreign key constraints
alter table public.routes
  add constraint routes_client_id_fkey
  foreign key (client_id) references public.billing_recipients(id) on delete set null;

alter table public.invoices
  add constraint invoices_client_id_fkey
  foreign key (client_id) references public.billing_recipients(id) on delete set null;


  -- Postgres RPC function with SECURITY DEFINER — it bypasses RLS but only returns data when a valid active token matches the staff_id. Secure and clean.
  create or replace function public.get_staff_info_for_portal(
  p_staff_id text,
  p_token text
)
returns table(staff_type text, phone text, address text)
language sql
security definer
stable
as $$
  select s.type, s.phone, s.address
  from public.staff s
  inner join public.staff_portal_tokens t on t.staff_id = s.id
  where s.id = p_staff_id
  and t.token = p_token
  and t.active = true
  limit 1;
$$;

-- ============================================================
-- 7. EDGE FUNCTION — delete-user
-- Deploy via: supabase functions deploy delete-user
-- Save the code below as: supabase/functions/delete-user/index.ts
-- ============================================================

/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { memberEmail } = await req.json();
    if (!memberEmail) {
      return new Response(JSON.stringify({ error: "memberEmail required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: membership } = await adminClient
      .from("workspace_members")
      .select("id")
      .eq("owner_user_id", caller.id)
      .eq("member_email", memberEmail.toLowerCase())
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden — not the owner" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1, perPage: 1000
    });
    if (listError) throw listError;

    const userToDelete = users.find(u => u.email?.toLowerCase() === memberEmail.toLowerCase());
    if (userToDelete) {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userToDelete.id);
      if (deleteError) throw deleteError;
    }

    await adminClient
      .from("workspace_members")
      .delete()
      .eq("owner_user_id", caller.id)
      .eq("member_email", memberEmail.toLowerCase());

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
*/



-- ============================================================
-- 9. SUPABASE DASHBOARD — MANUAL STEPS (per client)
-- ============================================================
-- Authentication > Settings:
--   Site URL:      https://app.clientdomain.co.uk
--   Redirect URLs: https://app.clientdomain.co.uk/reset-password
--
-- (Optional) Storage > New bucket:
--   Name: documents  |  Public: ON
--   Note: Cloudinary handles file storage — bucket not required

-- ============================================================
-- 10. ENV VARIABLES — set in Vercel per client deployment
-- ============================================================
-- VITE_SUPABASE_URL     = https://xxxxx.supabase.co
-- VITE_SUPABASE_ANON_KEY = eyJ...
-- VITE_OWNER_USER_ID    = uuid-of-owner (set after first signup)

-- ============================================================
-- 11. NEW CLIENT ONBOARDING CHECKLIST
-- ============================================================
-- [ ] Create new Supabase project
-- [ ] Update licence record above (client name, key, domain, email)
-- [ ] Run this SQL file
-- [ ] Deploy delete-user Edge Function
-- [ ] Set Authentication > Site URL + Redirect URLs in Supabase
-- [ ] Set Cloudinary: enable PDF delivery, Unsigned preset, allowed formats
-- [ ] Update src/config.js: companyName, companyInitials, primaryColour, licenceKey
-- [ ] Deploy to Vercel with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
-- [ ] Client goes to /signup → creates their account
-- [ ] Copy their UUID from Supabase Auth dashboard
-- [ ] Set VITE_OWNER_USER_ID in Vercel → Redeploy
-- [ ] Client configures Cloudinary in Settings page
-- [ ] Done ✓

-- added mot_expiry column to staff_licences table for MOT compliance tracking
alter table staff_licences add column if not exists mot_expiry date;