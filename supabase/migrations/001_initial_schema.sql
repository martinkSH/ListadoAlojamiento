-- ============================================================
-- SAY HUEQUE - Listado de Alojamiento
-- Migration 001: Schema inicial completo
-- ============================================================

-- Extensiones necesarias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLA: destinations
-- Destinos disponibles (BUE, SPA, IPC, etc.)
-- ============================================================
create table destinations (
  id          uuid primary key default uuid_generate_v4(),
  code        text not null unique,        -- 'BUE', 'SPA', 'IPC'
  name        text not null,               -- 'Buenos Aires', 'San Pedro de Atacama'
  country     text not null default 'AR',  -- 'AR', 'CL', 'BR'
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- TABLA: hotels
-- Un hotel por fila, con todos sus datos de contacto y config
-- ============================================================
create table hotels (
  id                  uuid primary key default uuid_generate_v4(),
  destination_id      uuid not null references destinations(id) on delete restrict,

  -- Identificación
  name                text not null,
  description         text,                         -- Habitación/tipo incluido en el nombre
  category            text not null                 -- 'Inn', 'Comfort', 'Superior', 'Luxury'
                        check (category in ('Inn/Apart', 'Inn', 'Comfort', 'Superior', 'Luxury')),
  priority            integer not null default 999, -- Orden dentro de su categoría en el destino
  currency            text not null default 'OFICIAL'
                        check (currency in ('OFICIAL', 'USD', 'EUR')),

  -- Logística
  distance_center     text,               -- '5 min', 'En el centro', etc.
  closing_date        date,               -- Fecha de cierre de temporada
  season_open         text,               -- 'Abierto todo el año', texto libre

  -- Flags
  is_family           boolean not null default false,
  family_type         text,               -- 'F1*', 'F2**', etc.
  is_direct           boolean not null default true,  -- Directo o plataforma
  platform_name       text,               -- 'Senderos Nativos', etc. si no es directo
  tourplan_code       text,               -- Código para Tourplan (exterior)

  -- Contacto
  contact_email       text,
  contact_name        text,
  contact_phone       text,

  -- Vigencias
  net_rate_validity   date,               -- Hasta cuándo vale la tarifa neta
  pc_rate_validity    date,               -- Hasta cuándo vale la tarifa precotizada
  rate_requested_at   date,               -- Fecha en que se pidió el tarifario

  -- Estado
  active              boolean not null default true,
  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Índices de búsqueda frecuente
create index hotels_destination_id_idx on hotels(destination_id);
create index hotels_category_idx on hotels(category);
create index hotels_priority_idx on hotels(destination_id, category, priority);
create index hotels_active_idx on hotels(active);

-- ============================================================
-- TABLA: rates
-- Tarifas por hotel, temporada y base de habitación
-- ============================================================
create table rates (
  id            uuid primary key default uuid_generate_v4(),
  hotel_id      uuid not null references hotels(id) on delete cascade,

  season        text not null check (season in ('24-25', '26-27')),
  room_base     text not null check (room_base in ('SGL', 'DBL', 'TPL')),

  -- Tarifa precotizada (lo que ve el pasajero)
  pc_rate       numeric(10,2),
  -- Tarifa neta (lo que paga Say Hueque al hotel)
  net_rate      numeric(10,2),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique(hotel_id, season, room_base)
);

create index rates_hotel_id_idx on rates(hotel_id);
create index rates_season_idx on rates(season);

-- ============================================================
-- TABLA: promotions
-- Promociones que puede tener o no cada hotel
-- ============================================================
create table promotions (
  id            uuid primary key default uuid_generate_v4(),
  hotel_id      uuid not null references hotels(id) on delete cascade,

  title         text not null,           -- 'Early booking', '3x2', etc.
  description   text,
  promo_type    text not null            -- 'early_booking', 'free_night', 'discount', 'other'
                  check (promo_type in ('early_booking', 'free_night', 'discount', 'other')),

  discount_pct  numeric(5,2),            -- % de descuento si aplica
  free_nights   integer,                 -- Noches gratis si aplica

  valid_from    date,
  valid_until   date,
  book_by       date,                    -- Fecha límite de reserva

  conditions    text,                    -- Texto libre con condiciones
  active        boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index promotions_hotel_id_idx on promotions(hotel_id);
create index promotions_active_idx on promotions(active);

-- ============================================================
-- TABLA: availability_requests
-- Pedidos de disponibilidad enviados al hotel
-- ============================================================
create table availability_requests (
  id              uuid primary key default uuid_generate_v4(),
  hotel_id        uuid not null references hotels(id) on delete restrict,

  -- Quién pidió
  operator_id     uuid references auth.users(id) on delete set null,
  operator_email  text not null,
  operator_name   text,

  -- Datos del pedido
  check_in        date not null,
  check_out       date not null,
  pax_count       integer not null default 1,
  room_base       text not null check (room_base in ('SGL', 'DBL', 'TPL')),
  room_count      integer not null default 1,
  notes           text,

  -- Estado y tokens
  status          text not null default 'pending'
                    check (status in ('pending', 'confirmed', 'unavailable', 'expired')),
  confirm_token   text not null unique default encode(gen_random_bytes(32), 'hex'),
  decline_token   text not null unique default encode(gen_random_bytes(32), 'hex'),

  -- Trazabilidad
  hotel_email_sent_at   timestamptz,
  responded_at          timestamptz,
  operator_notified_at  timestamptz,

  -- Expiración automática (7 días)
  expires_at      timestamptz not null default (now() + interval '7 days'),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index availability_requests_hotel_id_idx on availability_requests(hotel_id);
create index availability_requests_status_idx on availability_requests(status);
create index availability_requests_confirm_token_idx on availability_requests(confirm_token);
create index availability_requests_decline_token_idx on availability_requests(decline_token);
create index availability_requests_operator_id_idx on availability_requests(operator_id);

-- ============================================================
-- FUNCIÓN: updated_at automático en todas las tablas
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger destinations_updated_at
  before update on destinations
  for each row execute function set_updated_at();

create trigger hotels_updated_at
  before update on hotels
  for each row execute function set_updated_at();

create trigger rates_updated_at
  before update on rates
  for each row execute function set_updated_at();

create trigger promotions_updated_at
  before update on promotions
  for each row execute function set_updated_at();

create trigger availability_requests_updated_at
  before update on availability_requests
  for each row execute function set_updated_at();

-- ============================================================
-- FUNCIÓN: reordenar prioridades dentro de un destino/categoría
-- Llamar con: select reorder_hotel_priority(hotel_id, nueva_posicion)
-- ============================================================
create or replace function reorder_hotel_priority(
  p_hotel_id   uuid,
  p_new_priority integer
)
returns void as $$
declare
  v_destination_id uuid;
  v_category       text;
  v_old_priority   integer;
begin
  select destination_id, category, priority
  into v_destination_id, v_category, v_old_priority
  from hotels where id = p_hotel_id;

  if p_new_priority < v_old_priority then
    -- Mueve hacia arriba: empuja los del medio hacia abajo
    update hotels
    set priority = priority + 1
    where destination_id = v_destination_id
      and category = v_category
      and priority >= p_new_priority
      and priority < v_old_priority
      and id <> p_hotel_id;
  else
    -- Mueve hacia abajo: empuja los del medio hacia arriba
    update hotels
    set priority = priority - 1
    where destination_id = v_destination_id
      and category = v_category
      and priority > v_old_priority
      and priority <= p_new_priority
      and id <> p_hotel_id;
  end if;

  update hotels set priority = p_new_priority where id = p_hotel_id;
end;
$$ language plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table destinations         enable row level security;
alter table hotels                enable row level security;
alter table rates                 enable row level security;
alter table promotions            enable row level security;
alter table availability_requests enable row level security;

-- Solo usuarios autenticados pueden leer todo
create policy "Authenticated users can read destinations"
  on destinations for select to authenticated using (true);

create policy "Authenticated users can read hotels"
  on hotels for select to authenticated using (true);

create policy "Authenticated users can read rates"
  on rates for select to authenticated using (true);

create policy "Authenticated users can read promotions"
  on promotions for select to authenticated using (true);

create policy "Authenticated users can read their requests"
  on availability_requests for select to authenticated
  using (operator_id = auth.uid());

-- Solo usuarios autenticados pueden escribir
create policy "Authenticated users can insert hotels"
  on hotels for insert to authenticated with check (true);

create policy "Authenticated users can update hotels"
  on hotels for update to authenticated using (true);

create policy "Authenticated users can insert rates"
  on rates for insert to authenticated with check (true);

create policy "Authenticated users can update rates"
  on rates for update to authenticated using (true);

create policy "Authenticated users can manage promotions"
  on promotions for all to authenticated using (true);

create policy "Authenticated users can insert requests"
  on availability_requests for insert to authenticated with check (true);

-- Acceso anónimo SOLO para responder con token (confirm/decline)
-- La validación real la hace la API Route con el token
create policy "Public can update request status by token"
  on availability_requests for update to anon
  using (
    status = 'pending'
    and expires_at > now()
  );
