-- The origination tracker is separate from the application's broad status.
-- Legacy rows are placed using existing evidence, with their import basis visible in the UI.
create table public.loan_workflows (
  loan_application_id uuid primary key references public.loan_applications(id) on delete cascade,
  current_stage smallint not null default 1 check (current_stage between 1 and 12),
  completed boolean not null default false,
  imported_basis text,
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint completed_only_at_disbursement check (not completed or current_stage = 12)
);

create table public.loan_workflow_events (
  id uuid primary key default gen_random_uuid(),
  loan_application_id uuid not null references public.loan_applications(id) on delete cascade,
  from_stage smallint not null check (from_stage between 1 and 12),
  to_stage smallint not null check (to_stage between 1 and 12),
  action text not null check (action in ('advance', 'send_back', 'complete')),
  actor_id uuid not null references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create index loan_workflow_events_application_idx
  on public.loan_workflow_events (loan_application_id, created_at desc);

insert into public.loan_workflows (loan_application_id, current_stage, completed, imported_basis)
select
  a.id,
  case
    when exists (
      select 1 from public.loans l
      join public.loan_disbursements d on d.loan_id = l.id
      where l.loan_application_id = a.id
    ) then 12
    when a.status = 'approved' or exists (
      select 1 from public.loans l where l.loan_application_id = a.id
    ) then 9
    when a.status in ('submitted', 'under_review') then 3
    else 1
  end,
  exists (
    select 1 from public.loans l
    join public.loan_disbursements d on d.loan_id = l.id
    where l.loan_application_id = a.id
  ),
  case
    when exists (
      select 1 from public.loans l
      join public.loan_disbursements d on d.loan_id = l.id
      where l.loan_application_id = a.id
    ) then 'Recorded disbursement'
    when a.status = 'approved' or exists (
      select 1 from public.loans l where l.loan_application_id = a.id
    ) then 'Approved application or booked facility'
    when a.status in ('submitted', 'under_review') then 'Submitted application'
    else 'Existing application'
  end
from public.loan_applications a
on conflict (loan_application_id) do nothing;

alter table public.loan_workflows enable row level security;
alter table public.loan_workflow_events enable row level security;

create policy "employees can view loan workflows"
  on public.loan_workflows for select to authenticated
  using (public.is_active_employee());

create policy "employees can view loan workflow events"
  on public.loan_workflow_events for select to authenticated
  using (public.is_active_employee());

-- Only this function can change workflow state or append an event. Row locking
-- and the expected version prevent two staff actions from advancing the same stage.
create or replace function public.transition_loan_workflow(
  p_application_id uuid,
  p_expected_version integer,
  p_action text,
  p_note text default null
)
returns public.loan_workflows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_workflow public.loan_workflows%rowtype;
  v_next_stage smallint;
  v_maker uuid;
  v_result public.loan_workflows%rowtype;
begin
  if v_actor is null or not public.is_active_employee() then
    raise exception 'An active employee session is required';
  end if;
  if p_action is null or p_action not in ('advance', 'send_back', 'complete') then
    raise exception 'Invalid workflow action';
  end if;
  if p_action = 'send_back' and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'A reason is required to send a case back';
  end if;
  if length(coalesce(p_note, '')) > 2000 then
    raise exception 'Workflow note is too long';
  end if;

  insert into public.loan_workflows (loan_application_id)
  select p_application_id
  where exists (select 1 from public.loan_applications where id = p_application_id)
  on conflict (loan_application_id) do nothing;

  select * into v_workflow
  from public.loan_workflows
  where loan_application_id = p_application_id
  for update;
  if not found then
    raise exception 'Loan application not found';
  end if;
  if v_workflow.version <> p_expected_version then
    raise exception 'Workflow changed; refresh the page and try again';
  end if;
  if v_workflow.completed then
    raise exception 'This workflow is already complete';
  end if;

  if p_action = 'advance' then
    if v_workflow.current_stage = 12 then
      raise exception 'Record a disbursement and complete the final stage';
    end if;
    if v_workflow.current_stage = 11 then
      select actor_id into v_maker
      from public.loan_workflow_events
      where loan_application_id = p_application_id
        and from_stage = 10 and action = 'advance'
      order by created_at desc, id desc
      limit 1;
      if v_maker is null then
        raise exception 'OPS Maker must submit before OPS Checker can approve';
      end if;
      if v_maker = v_actor then
        raise exception 'OPS Checker must be a different employee from OPS Maker';
      end if;
    end if;
    v_next_stage := v_workflow.current_stage + 1;
  elsif p_action = 'send_back' then
    if v_workflow.current_stage = 1 then
      raise exception 'Enquiry is the first stage';
    end if;
    if exists (
      select 1 from public.loans l
      join public.loan_disbursements d on d.loan_id = l.id
      where l.loan_application_id = p_application_id
    ) then
      raise exception 'A disbursed case cannot be sent back';
    end if;
    v_next_stage := v_workflow.current_stage - 1;
  else
    if v_workflow.current_stage <> 12 then
      raise exception 'Only the Disbursed stage can be completed';
    end if;
    if not exists (
      select 1 from public.loans l
      join public.loan_disbursements d on d.loan_id = l.id
      where l.loan_application_id = p_application_id
    ) then
      raise exception 'Record the first disbursement before completing this stage';
    end if;
    v_next_stage := 12;
  end if;

  update public.loan_workflows
  set current_stage = v_next_stage,
      completed = p_action = 'complete',
      version = version + 1,
      updated_at = now()
  where loan_application_id = p_application_id
  returning * into v_result;

  insert into public.loan_workflow_events (
    loan_application_id, from_stage, to_stage, action, actor_id, note
  ) values (
    p_application_id, v_workflow.current_stage, v_next_stage, p_action, v_actor,
    nullif(btrim(coalesce(p_note, '')), '')
  );

  return v_result;
end;
$$;

revoke all on function public.transition_loan_workflow(uuid, integer, text, text) from public;
grant execute on function public.transition_loan_workflow(uuid, integer, text, text) to authenticated;

-- Once OPS Checker has moved the case to Disbursed, the first posted tranche
-- completes the tracker using the disbursement creator as the audit actor.
create or replace function public.complete_workflow_on_disbursement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workflow public.loan_workflows%rowtype;
begin
  select * into v_workflow
  from public.loan_workflows
  where loan_application_id = (
    select loan_application_id from public.loans where id = new.loan_id
  )
  for update;

  if found and v_workflow.current_stage = 12 and not v_workflow.completed then
    update public.loan_workflows
    set completed = true, version = version + 1, updated_at = now()
    where loan_application_id = v_workflow.loan_application_id;

    insert into public.loan_workflow_events (
      loan_application_id, from_stage, to_stage, action, actor_id, note
    ) values (
      v_workflow.loan_application_id, 12, 12, 'complete', new.created_by,
      'Completed when first disbursement tranche was recorded'
    );
  end if;
  return new;
end;
$$;

create trigger complete_loan_workflow_after_disbursement
after insert on public.loan_disbursements
for each row execute function public.complete_workflow_on_disbursement();
