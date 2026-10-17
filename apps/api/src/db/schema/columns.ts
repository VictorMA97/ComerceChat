import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';
import { newId } from '../../common/ids.js';

/** Clave primaria UUIDv7 generada en la aplicación. */
export const id = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => newId());

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date());

export interface GeoPoint {
  lng: number;
  lat: number;
}

/** GEOGRAPHY(Point, 4326) de PostGIS. Se escribe como EWKT; la lectura se hace con ST_X/ST_Y. */
export const geographyPoint = customType<{ data: GeoPoint; driverData: string }>({
  dataType: () => 'geography(Point, 4326)',
  toDriver: ({ lng, lat }) => `SRID=4326;POINT(${lng} ${lat})`,
});
