import type { Request, Response } from 'express'
import { ENTITIES } from '../config/entities.js'

export function getEntities(_req: Request, res: Response) {
  res.json(ENTITIES)
}