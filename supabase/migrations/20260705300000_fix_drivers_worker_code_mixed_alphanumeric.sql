-- Worker codes must be 5 chars with at least one letter and one digit.
-- Replaces generate_worker_code(); backfills missing/invalid codes only.

create or replace function public.generate_worker_code()
returns text
language plpgsql
volatile
as $$
declare
  letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  digits constant text := '23456789';
  chars text[] := array[]::text[];
  result text;
begin
  chars := array[
    substr(letters, 1 + floor(random() * length(letters))::int, 1),
    substr(digits, 1 + floor(random() * length(digits))::int, 1)
  ];

  while coalesce(array_length(chars, 1), 0) < 5 loop
    if random() < 0.5 then
      chars := array_append(
        chars,
        substr(letters, 1 + floor(random() * length(letters))::int, 1)
      );
    else
      chars := array_append(
        chars,
        substr(digits, 1 + floor(random() * length(digits))::int, 1)
      );
    end if;
  end loop;

  select string_agg(ch, '' order by random())
  into result
  from unnest(chars) as ch;

  return result;
end;
$$;

do $$
declare
  worker_row record;
begin
  for worker_row in
    select id, company
    from public.drivers
    where worker_code is null
      or btrim(worker_code) = ''
      or length(btrim(worker_code)) <> 5
      or upper(btrim(worker_code)) !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]+$'
      or upper(btrim(worker_code)) !~ '[ABCDEFGHJKLMNPQRSTUVWXYZ]'
      or upper(btrim(worker_code)) !~ '[2-9]'
    order by created_at nulls last, id
  loop
    update public.drivers
    set worker_code = public.generate_unique_worker_code(worker_row.company)
    where id = worker_row.id;
  end loop;
end;
$$;
