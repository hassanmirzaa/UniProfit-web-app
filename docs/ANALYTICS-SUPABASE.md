# Supabase app analytics

Detailed event analytics for the UniProfit web app are stored in Supabase. Events are sent from the browser to `POST /api/analytics` and written to the `analytics_events` table.

## Setup

1. **Create the table**  
   In Supabase Dashboard → SQL Editor, run **Part 4** of `supabase-scenarios.sql` (the block that creates `public.analytics_events` and its RLS policies).

2. **No extra env**  
   The app uses the same Supabase project and auth; `user_id` is set from the session when the user is logged in.

## Table: `analytics_events`

| Column          | Type      | Description |
|-----------------|-----------|-------------|
| `id`            | uuid      | Primary key |
| `created_at`    | timestamptz | Event time |
| `user_id`       | uuid (nullable) | From auth; null for anonymous |
| `session_id`    | text      | Client-generated session (sessionStorage) |
| `anonymous_id`  | text      | Client-generated anonymous id (localStorage) |
| `event_type`    | text      | Category: `page_view`, `calculation`, `scenario`, `calendar`, `ai_suggestions`, `export`, `auth` |
| `event_name`    | text      | Human-readable name |
| `page`          | text      | Pathname (e.g. `/ecommerce`) |
| `path`          | text      | Full path + query |
| `referrer`      | text      | document.referrer |
| `properties`    | jsonb     | Event-specific data (period, sku_count, scenario_id, etc.) |
| `user_agent`    | text      | Browser user agent |
| `viewport_width`  | int (nullable) | Window width |
| `viewport_height` | int (nullable) | Window height |

**RLS:** Inserts are allowed for the authenticated user (or anonymous with `user_id` null). **Select is not allowed** for the anon key, so only the Supabase Dashboard (or API with service role key) can read events.

---

## Event types and names

| event_type      | event_name examples        | properties (typical) |
|-----------------|----------------------------|----------------------|
| `page_view`     | path or title              | `path`, `title`      |
| `calculation`   | Reveal My True Profit      | `period`, `sku_count` |
| `scenario`      | Save template              | `scenario_name`, `period`, `sku_count` |
| `calendar`      | Record on calendar          | `period`, `start_date`, `end_date`, `net_profit`, `profit_margin` |
| `calendar`      | Open in calculator          | `scenario_id`        |
| `ai_suggestions`| AI suggestions requested   | `period`, `sku_count` |
| `export`       | Download CSV / Print summary | `period`           |
| `auth`          | Login attempt / Sign up attempt / Verify OTP | `method` (`google`, `email_password`, `otp`) |

---

## Example queries (Supabase SQL Editor)

Use the **service role** or run these in the Dashboard (Table Editor or SQL Editor with a role that can read the table).

### Events in the last 24 hours

```sql
select id, created_at, user_id, event_type, event_name, page, properties
from public.analytics_events
where created_at > now() - interval '24 hours'
order by created_at desc
limit 200;
```

### Page views by path (last 7 days)

```sql
select page, count(*) as views
from public.analytics_events
where event_type = 'page_view'
  and created_at > now() - interval '7 days'
group by page
order by views desc;
```

### Unique users (by user_id) per day

```sql
select date_trunc('day', created_at) as day, count(distinct user_id) as unique_users
from public.analytics_events
where created_at > now() - interval '30 days'
  and user_id is not null
group by date_trunc('day', created_at)
order by day desc;
```

### Calculations (Reveal My True Profit) by period

```sql
select properties->>'period' as period, count(*) as runs
from public.analytics_events
where event_type = 'calculation'
  and created_at > now() - interval '30 days'
group by properties->>'period'
order by runs desc;
```

### Calendar recordings in the last 30 days

```sql
select count(*) as recordings
from public.analytics_events
where event_type = 'calendar'
  and event_name = 'Record on calendar'
  and created_at > now() - interval '30 days';
```

### AI suggestions usage (requests) per day

```sql
select date_trunc('day', created_at) as day, count(*) as requests
from public.analytics_events
where event_type = 'ai_suggestions'
  and created_at > now() - interval '30 days'
group by date_trunc('day', created_at)
order by day desc;
```

### Auth: login/signup attempts by method

```sql
select event_name, properties->>'method' as method, count(*) as n
from public.analytics_events
where event_type = 'auth'
  and created_at > now() - interval '30 days'
group by event_name, properties->>'method'
order by n desc;
```

### Export actions (CSV vs Print)

```sql
select event_name, count(*) as n
from public.analytics_events
where event_type = 'export'
  and created_at > now() - interval '30 days'
group by event_name;
```

### Funnel: page_view → calculation → calendar (last 30 days)

```sql
with base as (
  select user_id, session_id, event_type, event_name, created_at
  from public.analytics_events
  where created_at > now() - interval '30 days'
    and (user_id is not null or session_id is not null)
),
calc as (
  select coalesce(user_id::text, session_id) as uid, min(created_at) as first_calc
  from base where event_type = 'calculation'
  group by coalesce(user_id::text, session_id)
),
rec as (
  select coalesce(user_id::text, session_id) as uid, min(created_at) as first_rec
  from base where event_type = 'calendar' and event_name = 'Record on calendar'
  group by coalesce(user_id::text, session_id)
)
select
  (select count(distinct coalesce(user_id::text, session_id)) from base where event_type = 'page_view' and page = '/ecommerce') as visited_calculator,
  (select count(*) from calc) as did_calculation,
  (select count(*) from rec) as did_record_calendar;
```

### Sessions (approximate) using session_id

```sql
select date_trunc('day', created_at) as day, count(distinct session_id) as sessions
from public.analytics_events
where created_at > now() - interval '7 days'
group by date_trunc('day', created_at)
order by day desc;
```

### Top referrers (last 7 days)

```sql
select referrer, count(*) as n
from public.analytics_events
where event_type = 'page_view'
  and created_at > now() - interval '7 days'
  and referrer is not null and referrer != ''
group by referrer
order by n desc
limit 20;
```

---

## Adding new events

1. **Client:** Call `track(event_type, event_name, properties)` from `@/lib/analytics` (e.g. in a click handler).
2. **Server:** No change; the API accepts any `event_type` / `event_name` and stores `properties` as jsonb.
3. **Docs:** Add the new event to the “Event types and names” table above and add a sample query if useful.

## Privacy and retention

- Events are stored in your Supabase project; RLS prevents app users from reading the table.
- For GDPR/privacy, consider: retention policy (e.g. delete events older than 12 months), anonymizing or dropping `user_agent`/`referrer` if not needed, and documenting this in your privacy policy.
