-- ============================================================
-- CROWN CARS — TRANSPORT MANAGEMENT SYSTEM
-- MASTER DATABASE SETUP SCRIPT v3 (CLEAN)
-- Run ONCE in a fresh Supabase project for each new client.
-- Do NOT run on an existing database — use migrations instead.
-- Last updated: May 2026
-- ============================================================

-- ============================================================
-- 1. TABLES
-- All foreign keys use ON DELETE SET NULL to prevent data loss.
-- Exceptions: workspace_members uses CASCADE (intentional).
-- billing_recipients.owner_user_id uses CASCADE (owner-bound).
-- billing_recipients is created first so routes/invoices can
-- reference it via client_id.
-- ============================================================

-- ── BILLING RECIPIENTS ──────────────────────────────────────
create table public.billing_recipients (
  id                  text primary key,
  owner_user_id       uuid references auth.users(id) on delete cascade,
  name                text not null,
  short_name          text default '',
  address             text default '',
  email               text default '',
  phone               text default '',
  supplier_ref        text default '',
  is_default          boolean default false,
  active              boolean default true,
  last_invoice_number integer default 0,
  notes               text default '',
  created_at          bigint
);

-- ── ROUTES ──────────────────────────────────────────────────
create table public.routes (
  id                text primary key,
  user_id           uuid references auth.users(id) on delete set null,
  number            text,
  name              text,
  po_number         text,
  school            text,
  primary_driver_id text,
  primary_pa_id     text,
  daily_rate        numeric default 0,
  driver_daily_rate numeric default 0,
  pa_daily_rate     numeric default 0,
  pa_pay_rate       numeric default 0,
  rate_bands        jsonb default '[]',
  operational_days  jsonb default '[1,2,3,4,5]',
  active            boolean default true,
  suspended         boolean default false,
  contract_start    text,
  contract_end      text,
  documents         jsonb default '[]',
  notes             text,
  client_id         text references public.billing_recipients(id) on delete set null,
  created_at        bigint
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
  client_id           text references public.billing_recipients(id) on delete set null,
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
  id             text primary key,
  user_id        uuid references auth.users(id) on delete set null,
  staff_id       text,
  amount         numeric,
  date           text,
  type           text,
  month          integer,
  year           integer,
  reference      text,
  notes          text,
  allocation_ids jsonb default '[]',
  period_month   integer,
  period_year    integer,
  is_external    boolean default false,
  external_name  text,
  created_at     bigint
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
  pa_staff_id      text default null,
  pa_staff_name    text default null,
  pa_days          numeric default 0,
  pa_rate          numeric default 0,
  pa_amount        numeric default 0,
  additive_entries jsonb default '[]',
  has_rate_split   boolean default false,
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

-- ── CHILDREN (pupils) ───────────────────────────────────────
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

-- ── STAFF PORTAL TOKENS ─────────────────────────────────────
create table public.staff_portal_tokens (
  id         text primary key,
  user_id    uuid references auth.users(id) on delete set null,
  staff_id   text,
  staff_name text,
  token      text unique,
  active     boolean default true,
  created_at bigint
);

-- ── STAFF INVOICE SUBMISSIONS ────────────────────────────────
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

-- ── STAFF APPLICATIONS ───────────────────────────────────────
create table public.staff_applications (
  id                     text primary key,
  target_user_id         uuid references auth.users(id) on delete set null,
  position_type          text,
  full_name              text,
  email                  text,
  phone                  text,
  current_address        text,
  previous_address       text,
  ni_number              text,
  nationality            text,
  has_uk_driving_licence boolean default false,
  requires_work_permit   boolean default false,
  work_permit_number     text,
  work_permit_doc_url    text,
  has_convictions        boolean default false,
  conviction_details     text,
  dbs_registered         boolean default false,
  dbs_name               text,
  dbs_dob                text,
  dbs_cert_number        text,
  dbs_update_id          text,
  applicant_refs         jsonb default '[]',
  declaration_agreed     boolean default false,
  declaration_name       text,
  declaration_date       text,
  status                 text default 'pending',
  admin_notes            text,
  created_at             bigint
);

-- ── WORKSPACE MEMBERS ────────────────────────────────────────
-- CASCADE is intentional — if either user is deleted,
-- the membership row should also be removed.
create table public.workspace_members (
  id             uuid primary key default gen_random_uuid(),
  owner_user_id  uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid references auth.users(id) on delete cascade,
  member_email   text not null,
  role           text default 'member',
  created_at     bigint,
  unique(owner_user_id, member_email)
);

-- ── LICENCES (white-label kill switch) ──────────────────────
-- Lives in the PLATFORM Supabase project, not the client project.
-- Included here for reference only.
create table public.licences (
  id            text primary key,
  client_name   text,
  licence_key   text unique,
  status        text default 'active',
  plan          text default 'standard',
  expires_at    text,
  domain        text,
  contact_email text,
  notes         text,
  created_at    bigint
);

-- ============================================================
-- 2. ROW LEVEL SECURITY — ENABLE ON ALL TABLES
-- ============================================================

alter table public.billing_recipients        enable row level security;
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
alter table public.licences                  enable row level security;

-- ============================================================
-- 3. HELPER FUNCTION
-- Returns true if the calling user belongs to owner_id's workspace.
-- Used by all RLS policies below — avoids repeated subqueries.
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
-- One "data_access" policy per table covers all operations.
-- Avoids policy conflict bugs from multiple overlapping policies.
-- ============================================================

-- ── Standard data tables ────────────────────────────────────

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

-- Anon can read active tokens to validate portal links
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

-- Anon can resubmit a recalled submission
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

-- Owner has full control
create policy "owner_manage" on public.workspace_members
  for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- Members can read their own membership row (needed on login)
create policy "member_read" on public.workspace_members
  for select to authenticated
  using (member_email = (auth.jwt() ->> 'email'));

-- Anon can check membership (used on /signup page)
create policy "anon_check" on public.workspace_members
  for select to anon using (true);

-- ── Licences ────────────────────────────────────────────────

create policy "public_read" on public.licences
  for select using (true);

create policy "admin_write" on public.licences
  for all to authenticated
  using (true) with check (true);

-- ── Billing recipients ───────────────────────────────────────

create policy "workspace_access" on public.billing_recipients
  for all using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm
      where wm.owner_user_id = billing_recipients.owner_user_id
      and wm.member_user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. ANON GRANTS
-- Required for public-facing pages: /apply and staff portal
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

-- Authenticated role — RLS policies control row-level access
grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

grant all on all sequences in schema public to authenticated, anon, service_role;
grant execute on all functions in schema public to authenticated, anon, service_role;

-- Anon role — only specific tables needed for public-facing pages
grant select on public.staff_portal_tokens          to anon;
grant insert on public.staff_invoice_submissions    to anon;
grant select on public.staff_invoice_submissions    to anon;
grant update on public.staff_invoice_submissions    to anon;
grant insert on public.staff_applications           to anon;
grant select on public.workspace_members            to anon;



-- ============================================================
-- 6. REALTIME
-- Live updates for admin when drivers submit or applicants apply
-- ============================================================

alter publication supabase_realtime add table public.staff_invoice_submissions;
alter publication supabase_realtime add table public.staff_applications;

-- ============================================================
-- 7. PORTAL RPC FUNCTION
-- Allows the unauthenticated staff portal to read basic staff
-- details (role, phone, address) for the "Your Details" section.
-- Security: only returns data when the token is valid and active.
-- ============================================================

create or replace function public.get_staff_info_for_portal(
  p_staff_id text,
  p_token    text
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
-- 8. EDGE FUNCTION — delete-user
-- Deploy via Supabase CLI: supabase functions deploy delete-user
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
-- 9. CLIENT LICENCE RECORD
-- Update these values for each new client before running.
-- This insert goes into the PLATFORM Supabase project, not here.
-- ============================================================

insert into public.licences (
  id, client_name, licence_key, status, plan,
  expires_at, domain, contact_email, created_at
) values (
  'CLIENT-001',
  'CLIENT COMPANY NAME',
  'CLIENT-LICENCE-KEY-HERE',
  'active',
  'standard',
  '2027-12-31',
  'app.clientdomain.co.uk',
  'client@theirdomain.co.uk',
  extract(epoch from now()) * 1000
);

-- ============================================================
-- 10. SUPABASE DASHBOARD — MANUAL STEPS (per client)
-- ============================================================
-- Authentication > Settings:
--   Site URL:       https://app.clientdomain.co.uk
--   Redirect URLs:  https://app.clientdomain.co.uk/reset-password

-- ============================================================
-- 11. VERCEL ENVIRONMENT VARIABLES (per client deployment)
-- ============================================================
-- VITE_SUPABASE_URL          = https://xxxxx.supabase.co
-- VITE_SUPABASE_ANON_KEY     = eyJ...
-- VITE_OWNER_USER_ID         = (set after client's first signup)
-- VITE_LICENCE_KEY           = CLIENT-LICENCE-KEY-HERE
-- VITE_PRIMARY_COLOUR        = #1d4ed8
-- VITE_COMPANY_NAME          = Company Name Ltd
-- VITE_COMPANY_INITIALS      = CC
-- VITE_COUNCIL_NAME          = (optional — e.g. West Sussex County Council)
-- VITE_SUPPLIER_NUMBER       = (optional — legacy, use billing recipients instead)
-- VITE_PLATFORM_SUPABASE_URL = (platform project URL — for licence validation)
-- VITE_PLATFORM_ANON_KEY     = (platform project anon key)

-- ============================================================
-- 12. NEW CLIENT ONBOARDING CHECKLIST
-- ============================================================
-- [ ] Create new Supabase project
-- [ ] Update licence record (section 9) with client details
-- [ ] Run this SQL file in Supabase SQL editor
-- [ ] Deploy delete-user Edge Function via Supabase CLI
-- [ ] Authentication > Settings: set Site URL + Redirect URLs
-- [ ] Set Cloudinary: enable PDF delivery, Unsigned preset
-- [ ] Deploy to Vercel with environment variables (section 11)
-- [ ] Client signs up at /signup → creates their account
-- [ ] Copy their UUID from Supabase Auth dashboard
-- [ ] Set VITE_OWNER_USER_ID in Vercel → Redeploy
-- [ ] Client configures Settings page:
--       • Company info (name, address, phone, email)
--       • Tax details (VAT number, VAT rate)
--       • Bank details (account name, sort code, account number)
--       • Billing recipient (e.g. WSCC, supplier ref, starting invoice number)
--       • Cloudinary (cloud name, upload preset)
-- [ ] Done ✓


-- added mot_expiry column to staff_licences table for MOT compliance tracking
alter table staff_licences add column if not exists mot_expiry date;

-- ============================================================
-- 13. UPDATE 2026-11-26 — security, multi-user, deductions
-- Safe to run more than once. Also used as the catch-up script
-- for existing databases (Crown Cars, Sunrise demo, XYZ test).
-- From now on every database change is added here (or as a new
-- dated section below) in ALL THREE master files.
-- ============================================================

-- ── 1. Who-changed-it stamp on every main table ────────────────────────────
create or replace function public.stamp_row()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  else
    new.created_by := old.created_by;
  end if;
  return new;
end $$;

do $$
declare
  t text;
  tables text[] := array[
    'routes','invoices','staff','payments','remittances','allocations',
    'po_history','audit_log','children','attendance','school_holidays',
    'settings','staff_licences','staff_training','staff_portal_tokens',
    'staff_invoice_submissions','staff_applications','billing_recipients'];
begin
  foreach t in array tables loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t
        and ((column_name = 'updated_at' and data_type <> 'timestamp with time zone')
          or (column_name in ('created_by','updated_by') and data_type <> 'uuid'))
    ) then
      raise exception 'Stopped: % already has updated_at/created_by/updated_by of a different type. Nothing was changed.', t;
    end if;
  end loop;
  foreach t in array tables loop
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('alter table public.%I add column if not exists created_by uuid default auth.uid()', t);
    execute format('alter table public.%I add column if not exists updated_by uuid', t);
    execute format('drop trigger if exists trg_stamp_row on public.%I', t);
    execute format('create trigger trg_stamp_row before insert or update on public.%I
                    for each row execute function public.stamp_row()', t);
  end loop;
end $$;

-- ── 2. Indexes for per-month loading ───────────────────────────────────────
create index if not exists attendance_user_month_idx  on public.attendance  (user_id, year, month);
create index if not exists allocations_user_month_idx on public.allocations (user_id, year, month);
create index if not exists invoices_user_month_idx    on public.invoices    (user_id, year, month);
create index if not exists payments_user_month_idx    on public.payments    (user_id, year, month);

-- ── 3. Team members: access by linked login, roles, guard ──────────────────
alter table public.workspace_members
  add column if not exists role text not null default 'admin'
  check (role in ('owner','admin','operations','accounts','viewer'));

create or replace function public.is_workspace_member(owner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where owner_user_id = owner_id and member_user_id = auth.uid()
  );
$$;

create or replace function public.workspace_role(owner_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when owner_id = auth.uid() then 'owner'
    else (select role from public.workspace_members
          where owner_user_id = owner_id and member_user_id = auth.uid() limit 1)
  end;
$$;

create or replace function public.guard_workspace_member_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Not allowed: workspace cannot be changed';
  end if;
  if auth.uid() is distinct from old.owner_user_id then
    if new.member_email is distinct from old.member_email
       or new.member_user_id is distinct from auth.uid()
       or new.role is distinct from old.role then
      raise exception 'Not allowed';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_workspace_member_update on public.workspace_members;
create trigger trg_guard_workspace_member_update
  before update on public.workspace_members
  for each row execute function public.guard_workspace_member_update();

create or replace function public.is_invited(p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from workspace_members where member_email = lower(trim(p_email)));
$$;
grant execute on function public.is_invited(text) to anon, authenticated;

-- ── 4. Staff portal: database functions are the only way in ────────────────
create or replace function public.portal_get_token(p_token text)
returns table(id text, staff_id text, staff_name text)
language sql stable security definer set search_path = public as $$
  select t.id::text, t.staff_id::text, t.staff_name::text
  from staff_portal_tokens t
  where t.token = p_token and t.active = true
  limit 1;
$$;

create or replace function public.portal_get_submission(p_token text, p_month int, p_year int)
returns table(id text, status text)
language sql stable security definer set search_path = public as $$
  select s.id::text, s.status::text
  from staff_invoice_submissions s
  join staff_portal_tokens t on t.id = s.token_id
  where t.token = p_token and t.active = true
    and s.month::text = p_month::text and s.year::text = p_year::text
  limit 1;
$$;

create or replace function public.portal_submit_invoice(
  p_token text, p_month int, p_year int, p_payload jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token    staff_portal_tokens%rowtype;
  v_existing staff_invoice_submissions%rowtype;
  v_now      bigint  := (extract(epoch from now()) * 1000)::bigint;
  v_amount   numeric := coalesce((p_payload->>'invoice_amount')::numeric, 0);
  v_rec      jsonb;
begin
  select * into v_token from staff_portal_tokens
   where token = p_token and active = true limit 1;
  if not found then raise exception 'invalid_link'; end if;

  if p_year not between 2020 and 2100 or p_month not between 0 and 12 then
    raise exception 'invalid_period';
  end if;
  if v_amount < 0 or v_amount > 100000 then
    raise exception 'invalid_amount';
  end if;

  select * into v_existing from staff_invoice_submissions
   where token_id = v_token.id
     and month::text = p_month::text and year::text = p_year::text
   limit 1;
  if found and v_existing.status <> 'recalled' then
    raise exception 'already_submitted';
  end if;

  v_rec := jsonb_build_object(
    'id',             coalesce(v_existing.id::text, gen_random_uuid()::text),
    'token_id',       v_token.id,
    'user_id',        v_token.user_id,
    'staff_id',       v_token.staff_id,
    'staff_name',     coalesce(nullif(p_payload->>'staff_name', ''), v_token.staff_name),
    'month',          p_month,
    'year',           p_year,
    'route_entries',  coalesce(p_payload->'route_entries', '[]'::jsonb),
    'cover_entries',  coalesce(p_payload->'cover_entries', '[]'::jsonb),
    'days_confirmed', p_payload->'days_confirmed',
    'invoice_amount', v_amount,
    'period_from',    p_payload->'period_from',
    'period_to',      p_payload->'period_to',
    'signature_name', p_payload->'signature_name',
    'signature_date', p_payload->'signature_date',
    'status',         'submitted',
    'submitted_at',   v_now,
    'created_at',     coalesce(to_jsonb(v_existing.created_at), to_jsonb(v_now))
  );

  if v_existing.id is null then
    insert into staff_invoice_submissions (
      id, token_id, user_id, staff_id, staff_name, month, year,
      route_entries, cover_entries, days_confirmed, invoice_amount,
      period_from, period_to, signature_name, signature_date,
      notes, status, submitted_at, approved_at, payment_id, created_at)
    select id, token_id, user_id, staff_id, staff_name, month, year,
      route_entries, cover_entries, days_confirmed, invoice_amount,
      period_from, period_to, signature_name, signature_date,
      notes, status, submitted_at, approved_at, payment_id, created_at
    from jsonb_populate_record(null::staff_invoice_submissions, v_rec);
  else
    update staff_invoice_submissions s set
      (staff_name, route_entries, cover_entries, days_confirmed, invoice_amount,
       period_from, period_to, signature_name, signature_date,
       status, submitted_at, approved_at, payment_id, notes) =
      (select r.staff_name, r.route_entries, r.cover_entries, r.days_confirmed,
              r.invoice_amount, r.period_from, r.period_to, r.signature_name,
              r.signature_date, r.status, r.submitted_at, r.approved_at,
              r.payment_id, r.notes
       from jsonb_populate_record(null::staff_invoice_submissions, v_rec) r)
    where s.id = v_existing.id;
  end if;

  return v_rec->>'id';
end $$;

grant execute on function public.portal_get_token(text) to anon, authenticated;
grant execute on function public.portal_get_submission(text, int, int) to anon, authenticated;
grant execute on function public.portal_submit_invoice(text, int, int, jsonb) to anon, authenticated;

-- ── 5. Close anonymous access ──────────────────────────────────────────────
drop policy if exists anon_insert             on public.staff_invoice_submissions;
drop policy if exists anon_select_by_token    on public.staff_invoice_submissions;
drop policy if exists anon_update_recalled    on public.staff_invoice_submissions;
drop policy if exists anon_read_active        on public.staff_portal_tokens;
drop policy if exists anon_select             on public.staff_portal_tokens;
drop policy if exists anon_check_member_email on public.workspace_members;
drop policy if exists anon_check              on public.workspace_members; -- name used in master setup files

-- Anon no longer reads/writes these tables directly (portal uses the functions above)
revoke select                 on public.staff_portal_tokens       from anon;
revoke insert, select, update on public.staff_invoice_submissions from anon;
revoke select                 on public.workspace_members         from anon;

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename = 'staff_applications' and policyname = 'anon_insert') then
    execute 'alter policy anon_insert on public.staff_applications
             with check (status = ''pending'' and admin_notes is null)';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
             and tablename = 'billing_recipients' and policyname = 'workspace_access') then
    execute 'alter policy workspace_access on public.billing_recipients to authenticated';
  end if;
end $$;

-- Duplicate policies (data_access already covers owner + members)
drop policy if exists owner_all     on public.staff_invoice_submissions;
drop policy if exists member_select on public.staff_invoice_submissions;
drop policy if exists member_update on public.staff_invoice_submissions;
drop policy if exists member_delete on public.staff_invoice_submissions;
drop policy if exists owner_all     on public.staff_licences;
drop policy if exists member_select on public.staff_licences;
drop policy if exists member_update on public.staff_licences;
drop policy if exists member_delete on public.staff_licences;
drop policy if exists owner_all     on public.staff_portal_tokens;
drop policy if exists member_select on public.staff_portal_tokens;
drop policy if exists member_update on public.staff_portal_tokens;
drop policy if exists member_delete on public.staff_portal_tokens;
drop policy if exists owner_all     on public.staff_training;
drop policy if exists member_select on public.staff_training;
drop policy if exists member_update on public.staff_training;
drop policy if exists member_delete on public.staff_training;
drop policy if exists owner_read    on public.staff_applications;
drop policy if exists owner_update  on public.staff_applications;
drop policy if exists owner_delete  on public.staff_applications;

-- ── 6. Deductions (staff charges) ──────────────────────────────────────────
create table if not exists public.staff_charges (
  id            text primary key default gen_random_uuid()::text,
  user_id       uuid not null,
  staff_id      text,
  staff_name    text not null,
  is_external   boolean not null default false,
  charge_date   date not null default current_date,
  category      text not null default 'other',
  description   text,
  amount        numeric(10,2) not null check (amount > 0),
  deduct_month  int not null check (deduct_month between 0 and 11),
  deduct_year   int not null check (deduct_year between 2020 and 2100),
  group_id      text,
  instalment_no int not null default 1,
  instalments   int not null default 1,
  status        text not null default 'outstanding'
                check (status in ('outstanding','deducted','waived')),
  payment_id    text,
  notes         text,
  created_at    bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_by    uuid
);
alter table public.staff_charges enable row level security;
drop policy if exists data_access on public.staff_charges;
create policy data_access on public.staff_charges
  for all to authenticated
  using ((user_id = auth.uid()) or is_workspace_member(user_id))
  with check ((user_id = auth.uid()) or is_workspace_member(user_id));
drop trigger if exists trg_stamp_row on public.staff_charges;
create trigger trg_stamp_row
  before insert or update on public.staff_charges
  for each row execute function public.stamp_row();
create index if not exists staff_charges_user_month_idx
  on public.staff_charges (user_id, deduct_year, deduct_month);

-- ── 7. Members can link their own login on first sign-in ───────────────────
-- (AuthContext sets member_user_id; the guard trigger above stops anything else)
drop policy if exists member_update_own on public.workspace_members;
create policy member_update_own on public.workspace_members
  for update to authenticated
  using (member_email = (auth.jwt() ->> 'email'))
  with check (member_email = (auth.jwt() ->> 'email'));

-- ── 8. Portal "Your details" — now also returns the name ───────────────────
drop function if exists public.get_staff_info_for_portal(text, text);
create function public.get_staff_info_for_portal(p_staff_id text, p_token text)
returns table(staff_type text, phone text, address text, name text)
language sql stable security definer set search_path = public as $$
  select s.type, s.phone, s.address, s.name
  from public.staff s
  inner join public.staff_portal_tokens t on t.staff_id = s.id
  where s.id = p_staff_id and t.token = p_token and t.active = true
  limit 1;
$$;
grant execute on function public.get_staff_info_for_portal(text, text) to anon, authenticated;

-- ── 9. MOT expiry (compliance) ─────────────────────────────────────────────
alter table public.staff_licences add column if not exists mot_expiry date;

-- ── 10. Licences (PLATFORM / Crown Cars database only) ─────────────────────
-- Only the platform owner can change licences; sites check their own key
-- through validate_licence() instead of reading the table.
-- Platform owner = Fazan's Supabase user id (Authentication → Users).
drop policy if exists admin_write          on public.licences;
drop policy if exists platform_admin_write on public.licences;
create policy platform_admin_write on public.licences
  for all to authenticated
  using (auth.uid() = 'f3cf0783-92e2-4269-a7e1-e9b3db6203a3'::uuid)
  with check (auth.uid() = 'f3cf0783-92e2-4269-a7e1-e9b3db6203a3'::uuid);

create or replace function public.validate_licence(p_key text)
returns table(client_name text, plan text, status text, expires_at text)
language sql stable security definer set search_path = public as $$
  select l.client_name::text, l.plan::text, l.status::text, l.expires_at::text
  from licences l
  where l.licence_key = p_key
  limit 1;
$$;
grant execute on function public.validate_licence(text) to anon, authenticated;

-- Nobody reads the licences table directly any more
drop policy if exists public_read       on public.licences;
drop policy if exists "public validate" on public.licences;