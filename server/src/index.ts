import express from 'express';
import cors from 'cors';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { pool } from './db';
import type { Request, Response, NextFunction} from 'express'
import companiesRouter from './routes/companies'
import applicationsRouter from './routes/applications'
import contactsRouter from './routes/contacts'
import interviewStageRouter from './routes/interview_stages'
import resumesRouter from './routes/resumes';




const app = express();
//inspects each incoming request for a signed token the frontend automatically attaches
//middleware - a function that runs between an incoming request and your route handler
app.use(clerkMiddleware());
//cors enusres that websites open in a browser tab cannot use a user's active session to read data from another website without explict permission
app.use(cors());
//allows you to build web servers and APIs using javascript
app.use(express.json());

app.use('/companies', companiesRouter);
app.use('/applications', applicationsRouter);
app.use('/contacts', contactsRouter);
app.use('/interview_stages', interviewStageRouter);
app.use('/resumes', resumesRouter);




const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
