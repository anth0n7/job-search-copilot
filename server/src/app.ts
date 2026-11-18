import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
//Imported only for its side effect: db.ts loads the secrets file, and that must happen before the routers
//below load the AI modules (they read their API keys the moment they are imported).
import './db';
import type { Request, Response, NextFunction} from 'express'
import companiesRouter from './routes/companies'
import applicationsRouter from './routes/applications'
import contactsRouter from './routes/contacts'
import interviewStageRouter from './routes/interview_stages'
import resumesRouter from './routes/resumes';
import { sendServerError } from './errors';




const app = express();
//inspects each incoming request for a signed token the frontend automatically attaches
//middleware - a function that runs between an incoming request and your route handler
app.use(clerkMiddleware());
//cors enusres that websites open in a browser tab cannot use a user's active session to read data from another website without explict permission
//only the frontend's own address may call the API from a browser. CLIENT_ORIGIN can hold several addresses separated by commas.
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));
//allows you to build web servers and APIs using javascript
app.use(express.json());

app.use('/companies', companiesRouter);
app.use('/applications', applicationsRouter);
app.use('/contacts', contactsRouter);
app.use('/interview_stages', interviewStageRouter);
app.use('/resumes', resumesRouter);

//Error handler: Express sends errors from express.json() (too big, bad JSON) here instead of replying with an HTML page.
//It must come after the routes and take 4 arguments, that is how Express knows it is an error handler.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request too large' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  sendServerError(res, err);
});

export default app;
