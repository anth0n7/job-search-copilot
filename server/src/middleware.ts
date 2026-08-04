import { getAuth } from '@clerk/express';
import type { Request, Response, NextFunction} from 'express'

export function requireAuth(req: Request, res: Response, next: NextFunction){
  const { isAuthenticated } = getAuth(req);
  if(!isAuthenticated){
    return res.status(401).json({error: 'User not logged in'});
  }
  next();
}

