import type { Request, Response, NextFunction } from 'express'
import type { Entity } from '@crm/shared'
import { database, DatabaseUnavailableError } from '../db.js'
import { ENTITIES } from '../config/entities.js'

/**
 * Seller entity presets. Reads from `companies` (legal_name + profile jsonb,
 * seeded/edited via migration 002) when the database is configured, and
 * falls back to the static `ENTITIES` config when it isn't — e.g. local dev
 * without Postgres, or the pure `POST /api/invoices/compute` test suite.
 */
export async function getEntities(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await database().query<{ id: string; legal_name: string; gstin: string | null; pan: string | null; profile: Record<string, unknown> }>(
      `SELECT id, legal_name, gstin, pan, profile FROM companies ORDER BY legal_name`,
    )
    const entities: Entity[] = result.rows.map((row) => ({
      id: row.id,
      name: row.legal_name,
      gstin: row.gstin ?? '',
      pan: row.pan ?? '',
      ...(row.profile as object),
    } as Entity))
    res.json(entities)
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return res.json(ENTITIES)
    next(error)
  }
}
