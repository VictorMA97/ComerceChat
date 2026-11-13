-- MS F3: el PSP simulado es un servicio aparte con sus propias migraciones (services/fake-psp), que
-- crean el esquema fake_psp. Aquí se quita el que creaba la línea base de la API.
-- Corregido a mano: IF EXISTS y CASCADE, por si ya se habían aplicado las del simulador; `pnpm
-- db:migrate` aplica siempre después las de los simuladores, que lo vuelven a crear.
DROP SCHEMA IF EXISTS "fake_psp" CASCADE;
