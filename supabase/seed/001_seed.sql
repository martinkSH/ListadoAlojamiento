-- ============================================================
-- SAY HUEQUE - Seed de datos iniciales
-- Basado en el Listado de Alojamiento 2026-2027
-- ============================================================

-- ============================================================
-- DESTINOS
-- ============================================================
insert into destinations (code, name, country) values
  -- Argentina
  ('BUE', 'Buenos Aires',           'AR'),
  ('BAR', 'Bariloche',              'AR'),
  ('MDZ', 'Mendoza',                'AR'),
  ('CAL', 'Calafate',               'AR'),
  ('CHA', 'Chaltén',                'AR'),
  ('IGU', 'Iguazú',                 'AR'),
  ('SAL', 'Salta',                  'AR'),
  ('SJU', 'San Juan',               'AR'),
  ('TUC', 'Tucumán',                'AR'),
  ('SLU', 'San Luis',               'AR'),
  ('COR', 'Córdoba',                'AR'),
  ('ROS', 'Rosario',                'AR'),
  ('MAR', 'Mar del Plata',          'AR'),
  ('VAL', 'Valdes',                 'AR'),
  ('USH', 'Ushuaia',                'AR'),
  ('PMP', 'Puerto Madryn',          'AR'),
  -- Chile
  ('SPA', 'San Pedro de Atacama',   'CL'),
  ('IPC', 'Isla de Pascua',         'CL'),
  ('TOR', 'Torres del Paine',       'CL'),
  ('CHI', 'Chiloé',                 'CL'),
  ('PUC', 'Pucón',                  'CL'),
  ('CAR', 'Carretera Austral',      'CL'),
  ('STG', 'Santiago',               'CL'),
  -- Brasil
  ('BRS', 'Brasil - General',       'BR')
on conflict (code) do nothing;


-- ============================================================
-- HOTELES - Buenos Aires (muestra representativa)
-- Basado en hoja ARGENTINA 26-27
-- ============================================================
with dest as (select id from destinations where code = 'BUE')
insert into hotels (
  destination_id, name, description, category, priority,
  distance_center, contact_email, is_direct,
  closing_date, net_rate_validity, active
) values

-- INN/APART
((select id from dest), 'Palermo JAI (Apartamento Deluxe) Con Desayuno en Hotel Clásico Costa Rica 5480 MIN 2 NTS', null, 'Inn/Apart', 1, 'Palermo', 'reservas@palermojai.com', true, null, '2027-02-28', true),
((select id from dest), 'Loi Flats Recoleta (Sgl/Dbl - Apto 1 Amb // Tpl - Apto 2 Amb - FREE SALE', null, 'Inn/Apart', 2, 'Recoleta', 'reservas@loisuites.com.ar', true, null, '2027-02-28', true),
((select id from dest), 'Own Palermo (Standard Vista Interna SGL/DBL - Suite TPL) Con Desayuno en Nucha', null, 'Inn/Apart', 3, 'Barrio Norte', 'felicitas.mendieta@ownhotels.com', true, '2027-01-04', '2027-01-04', true),
((select id from dest), 'Top Rentals Palermo Soho (Studio SGL/DBL - 2 ambientes TPL) con Desayuno en El Secreto de Oro', null, 'Inn/Apart', 4, 'Palermo', 'reservas@thetoprentals.com', true, '2026-12-31', '2026-12-31', true),
((select id from dest), 'Top Rentals Palermo Hollywood (Studio SGL/DBL - 2 ambientes TPL)', null, 'Inn/Apart', 5, 'Palermo', 'corporativo1@thetoprentals.com', true, '2026-12-31', '2026-12-31', true),

-- INN
((select id from dest), 'Dazzler Palermo (Classic) - FREE SALE', null, 'Inn', 1, '5,4 km del centro', 'reservas@dazzlerpalermo.com', true, null, '2027-06-30', true),
((select id from dest), 'L Hotel (Superior)', null, 'Inn', 2, null, 'Reservas@lhotelpalermo.com', true, '2026-12-31', '2026-12-31', true),
((select id from dest), 'Arc Recoleta (Superior)', null, 'Inn', 3, 'Recoleta', 'reservas@archoteles.com.ar', true, '2026-12-31', '2027-04-30', true),
((select id from dest), '248 Finisterra (Superior) TPL solo SUITE', null, 'Inn', 4, 'Palermo (polo)', 'reservas@248finisterra.com', true, '2026-12-15', null, true),
((select id from dest), 'Blank Hotel Recoleta (Deluxe Queen) NEW', null, 'Inn', 5, null, 'reservas@blankhotel.com', true, '2026-12-31', '2026-12-31', true),
((select id from dest), 'Clasico (Deluxe)', null, 'Inn', 6, 'Palermo', 'reservas@hotelclasico.com', true, '2026-12-31', '2026-12-31', true),
((select id from dest), 'Bromelia (Balcony)', null, 'Inn', 7, 'Recoleta', 'reservas@bromeliahotel.com.ar', true, null, '2026-12-31', true),
((select id from dest), 'Kenton Palace (Clásica)', null, 'Inn', 8, 'San Telmo', 'reservas1@kentonpalace.com.ar', true, null, '2027-08-31', true),
((select id from dest), 'Libertador (Classic)', null, 'Inn', 9, 'Centro', 'reservas@libertadorhotels.com', true, '2026-02-28', null, true),

-- COMFORT
((select id from dest), 'Dazzler Polo (Classic) - FREE SALE', null, 'Comfort', 1, 'Palermo botánico', 'reservas@dazzlerpolo.com', true, null, '2027-06-30', true),
((select id from dest), 'Vain (Standard / TPL ROH)', null, 'Comfort', 2, 'Palermo', 'reservas@vainuniverse.com', true, '2026-04-30', '2026-04-30', true);


-- ============================================================
-- HOTELES - San Pedro de Atacama
-- Basado en hoja EXTERIOR 26-27
-- ============================================================
with dest as (select id from destinations where code = 'SPA')
insert into hotels (
  destination_id, name, description, category, priority,
  distance_center, contact_email, is_direct,
  closing_date, net_rate_validity, active
) values
-- INN
((select id from dest), 'Hotel La Casa de Don Tomas (Standard)', null, 'Inn', 1, '9 min', 'reservas@dontomas.cl', true, null, '2026-03-31', true),
((select id from dest), 'Hotel Don Raul (Standard Clásica)', null, 'Inn', 2, 'En el centro', 'reservas@donraul.cl', true, null, '2027-03-31', true),
((select id from dest), 'Diego de Almagro Atacama (Standard)', null, 'Inn', 3, '6 min', 'centraldereservas@dahoteles.com', true, '2026-12-31', '2026-12-31', true),

-- COMFORT
((select id from dest), 'Hotel La Casa de Don Tomas (Superior)', null, 'Comfort', 1, '9 min', 'reservas@dontomas.cl', true, null, '2026-03-31', true),
((select id from dest), 'Hotel Kimal (Standard)', null, 'Comfort', 2, 'En el centro', 'reservas@kimal.cl', true, null, '2027-04-15', true),

-- SUPERIOR
((select id from dest), 'Hotel Casa Solcor Boutique Bed & Breakfast (Kala)', null, 'Superior', 1, null, 'contacto@casasolcor.cl', true, null, '2027-03-31', true),
((select id from dest), 'Terrantai Lodge Andino (SGL/DBL Intiwasi Standard - TPL Andina)', null, 'Superior', 2, 'En el centro', 'info@terrantai.com', true, null, '2027-03-31', true),
((select id from dest), 'Our Habitas Atacama (Pioneer)', null, 'Superior', 3, 'En el centro', 'reservations.atacama@ourhabitas.com', true, '2027-01-05', '2027-01-05', true),
((select id from dest), 'Cumbres San Pedro de Atacama (Superior)', null, 'Superior', 4, '19 min', 'reservas@hotelescumbres.cl', true, '2026-03-31', '2026-04-30', true),
((select id from dest), 'Desertica (Turi Standard) NEW', null, 'Superior', 5, null, 'reservas@desertica.com', true, null, '2026-05-31', true),

-- LUXURY
((select id from dest), 'Nayara Alto Atacama (opción B&B y Programas)', null, 'Luxury', 1, '43 min', 'reservations@nayararesorts.com', true, null, '2026-04-05', true),
((select id from dest), 'Awasi Atacama (Programas de 3 a 6 noches)', null, 'Luxury', 2, 'En el centro', 'info@awasi.com', true, null, '2025-09-30', true),
((select id from dest), 'Tierra Atacama (Programas de 2 a 7 noches)', null, 'Luxury', 3, '20 min', 'info@tierrahotels.com', true, null, '2027-09-30', true),
((select id from dest), 'Explora Atacama', null, 'Luxury', 4, '11 min', 'reserve@explora.com', true, null, '2027-04-29', true);


-- ============================================================
-- TARIFAS - Buenos Aires (Inn/Apart, temporada 26-27)
-- ============================================================
insert into rates (hotel_id, season, room_base, pc_rate, net_rate)
select h.id, '26-27', 'SGL', 143, 74
from hotels h join destinations d on h.destination_id = d.id
where d.code = 'BUE' and h.name ilike '%Palermo JAI (Apartamento%';

insert into rates (hotel_id, season, room_base, pc_rate, net_rate)
select h.id, '26-27', 'DBL', 143, 74
from hotels h join destinations d on h.destination_id = d.id
where d.code = 'BUE' and h.name ilike '%Palermo JAI (Apartamento%';

insert into rates (hotel_id, season, room_base, pc_rate, net_rate)
select h.id, '26-27', 'TPL', 181.5, 74
from hotels h join destinations d on h.destination_id = d.id
where d.code = 'BUE' and h.name ilike '%Palermo JAI (Apartamento%';

-- Dazzler Palermo
insert into rates (hotel_id, season, room_base, pc_rate, net_rate)
select h.id, '26-27', 'SGL', 159.5, 135
from hotels h join destinations d on h.destination_id = d.id
where d.code = 'BUE' and h.name ilike '%Dazzler Palermo%';

insert into rates (hotel_id, season, room_base, pc_rate, net_rate)
select h.id, '26-27', 'DBL', 159.5, 135
from hotels h join destinations d on h.destination_id = d.id
where d.code = 'BUE' and h.name ilike '%Dazzler Palermo%';

insert into rates (hotel_id, season, room_base, pc_rate, net_rate)
select h.id, '26-27', 'TPL', 198, 169
from hotels h join destinations d on h.destination_id = d.id
where d.code = 'BUE' and h.name ilike '%Dazzler Palermo%';


-- ============================================================
-- TARIFAS - San Pedro de Atacama (muestra)
-- ============================================================
insert into rates (hotel_id, season, room_base, pc_rate, net_rate)
select h.id, '26-27', 'SGL', 187, 108
from hotels h join destinations d on h.destination_id = d.id
where d.code = 'SPA' and h.name ilike '%Don Tomas (Standard)%';

insert into rates (hotel_id, season, room_base, pc_rate, net_rate)
select h.id, '26-27', 'DBL', 187, 108
from hotels h join destinations d on h.destination_id = d.id
where d.code = 'SPA' and h.name ilike '%Don Tomas (Standard)%';

insert into rates (hotel_id, season, room_base, pc_rate, net_rate)
select h.id, '26-27', 'TPL', 231, 178
from hotels h join destinations d on h.destination_id = d.id
where d.code = 'SPA' and h.name ilike '%Don Tomas (Standard)%';
