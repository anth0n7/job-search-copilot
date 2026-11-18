import { getAuth } from '@clerk/express';
import type { Request, Response, NextFunction} from 'express'

export function requireAuth(req: Request, res: Response, next: NextFunction){
  const { isAuthenticated } = getAuth(req);
  if(!isAuthenticated){
    return res.status(401).json({error: 'User not logged in'});
  }
  next();
}


//The signed-in user's id, for use inside a route that already has requireAuth.
//TypeScript only knows the id might be null, so this replaces a blind `userId!`: if a route is ever written
//without requireAuth, it fails loudly here (a 500) instead of carrying on with no user.
export function currentUserId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) {
    throw new Error('No signed-in user: is requireAuth missing on this route?');
  }
  return userId;
}
