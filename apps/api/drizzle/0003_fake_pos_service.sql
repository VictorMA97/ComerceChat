-- MS F3: el software de caja simulado es un servicio aparte con sus propias migraciones
-- (services/fake-pos), que crean el esquema fake_pos. Aquí se quita el de la línea base de la API.
-- Corregido a mano: IF EXISTS y CASCADE, como en 0002; `pnpm db:migrate` aplica después las de los
-- simuladores.
DROP SCHEMA IF EXISTS "fake_pos" CASCADE;
