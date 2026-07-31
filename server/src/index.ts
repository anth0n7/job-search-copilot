import express from 'express';
import cors from 'cors';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { pool } from './db';
import type { Request, Response, NextFunction} from 'express'

const app = express();
//inspects each incoming request for a signed token the frontend automatically attaches
//middleware - a function that runs between an incoming request and your route handler
app.use(clerkMiddleware());
//cors enusres that websites open in a browser tab cannot use a user's active session to read data from another website without explict permission
app.use(cors());
//allows you to build web servers and APIs using javascript
app.use(express.json());

function requireAuth(req: Request, res: Response, next: NextFunction){
  const { isAuthenticated } = getAuth(req);
  if(!isAuthenticated){
    return res.status(401).json({error: 'User not logged in'});
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

//await, pause function until Postgres actually responds. Must use async
//res sent back to whoever called route
app.get('/db-health', async (req, res) =>{
  try{
    const result = await pool.query('SELECT NOW()');
    res.json({status: 'ok', time: result.rows[0]});
  } catch (err) {
    res.status(500).json({status: 'error', message: String(err)});
  }
});

//Select statement - get very column from every row
//in the companies table newest first
//result.rows because you want all of the companies
app.get('/companies', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const result = await pool.query('SELECT * FROM companies WHERE user_id = $1 ORDER BY created_at DESC ',
      [userId]
    );
    res.json(result.rows);
  } catch (err){
    res.status(500).json({error: String(err)});
  }
});

//results.rows give you an array containing one full row
//results.rows[0] unwraps the array and give you the object itself
app.post('/companies', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try {
    const {name, website, notes} = req.body;
    const result = await pool.query('INSERT INTO companies (name, website, notes, user_id) VALUES ($1, $2, $3, $4) RETURNING * ',
      [name, website, notes, userId]
    );
    res.json(result.rows[0]);
  } catch (err){
    res.status(500).json({error: String(err)});
  }
});

app.get('/companies/:id', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const companyID = req.params.id;
    const result = await pool.query('SELECT * FROM companies WHERE id =  $1 AND user_id = $2',
      [companyID, userId]
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'Company not found'});
    }
    res.json(result.rows[0]);
  } catch (err){
    res.status(500).json({error: String(err)});
  }
});

//Without WHERE - update every single row in applications to these values
app.put('/companies/:id', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const {name, website, notes} = req.body;
    const id = req.params.id;
    const result = await pool.query('UPDATE companies SET name = $1, website = $2, notes = $3 WHERE id = $4 AND user_id = $5 RETURNING *',
      [name, website, notes, id, userId]
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'Company not found'});
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({error: String(err)});
  }
});

app.delete('/companies/:id', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const id = req.params.id;
    const result = await pool.query('DELETE FROM companies WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'Company not found'});
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({error: String(err)});
  } 
});


//applications.* - give me every column, but only from applications (both talbes might have columns with the same name)
app.get('/applications', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const result = await pool.query('SELECT applications.* FROM applications JOIN companies ON applications.company_id = companies.id WHERE companies.user_id = $1',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({error: String(err)});
  }
});

//first query to verify company id actually belongs to the user
app.post('/applications', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const {company_id, role_title, job_posting_url, status, application_date} = req.body;
    const auth = await pool.query('SELECT * FROM companies WHERE user_id = $1 AND id = $2',
      [userId, company_id]
    );
    if(auth.rows.length === 0){
      return res.status(403).json({error: 'User not allowed access to company'});
    }
    const result = await pool.query('INSERT INTO applications (company_id, role_title, job_posting_url, status, application_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [company_id, role_title, job_posting_url, status, application_date]  
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    if(err.code === '23503'){
      return res.status(400).json({error: 'That company does not exist'});
    }
    res.status(500).json({error: String(err)});
  }
});

//404 is good here because it doesn't reveal "exists but not yours"
app.get('/applications/:id', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const applicationID = req.params.id;
    const result = await pool.query('SELECT applications.* FROM applications JOIN companies ON applications.company_id = companies.id WHERE applications.id = $1 and companies.user_id = $2',
      [applicationID, userId]
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'application not found'});
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({error: String(err)});
  }
});

app.put('/applications/:id', requireAuth, async(req, res) =>{
  const { userId } = getAuth(req);
  try{
    const {company_id, role_title, job_posting_url, status, application_date} = req.body;
    const applicationID = req.params.id;
    
    //joining the two tables and finding applications that belong to the current usersId
    const auth = await pool.query('SELECT applications.id FROM applications JOIN companies ON applications.company_id = companies.id WHERE applications.id = $1 and companies.user_id = $2',
      [applicationID, userId]
    );
    if(auth.rows.length === 0){
      return res.status(404).json({error: 'Application not found'})
    }

    //make sure the new company id request belongs to the user
    const companyIdAuth = await pool.query('SELECT * FROM companies WHERE user_id = $1 AND id = $2',
      [userId, company_id]
    );
    if(companyIdAuth.rows.length === 0){
      return res.status(404).json({error: 'Company not found'});
    }

    //update the application
    const result = await pool.query('UPDATE applications SET company_id = $1, role_title = $2, job_posting_url = $3, status = $4, application_date = $5 WHERE id = $6 RETURNING *',
      [company_id, role_title, job_posting_url, status, application_date, applicationID]
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'Application not found'});
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({error: String(err)});
  }
});

app.delete('/applications/:id', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const applicationID = req.params.id;
    const auth = await pool.query('SELECT applications.id FROM applications JOIN companies on applications.company_id = companies.id WHERE applications.id = $1 and companies.user_id = $2',
      [applicationID, userId]
    )
    if(auth.rows.length === 0){
      return res.status(404).json({error: 'Application not found'});
    }

    const result = await pool.query('DELETE FROM applications WHERE id = $1 RETURNING *',
      [applicationID]
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'Application not found'});
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({error: String(err)});
  }
});

app.get('/contacts', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const result = await pool.query('SELECT contacts.* FROM contacts JOIN companies ON contacts.company_id = companies.id WHERE companies.user_id = $1',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({error: String(err)});
  }
});

app.get('/contacts/:id', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const contactID = req.params.id;
    const result = await pool.query('SELECT contacts.* FROM contacts JOIN companies ON contacts.company_id = companies.id WHERE contacts.id = $1 AND companies.user_id = $2',
      [contactID, userId]
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'Contact not found'});
    }
    res.json(result.rows[0]);
  } catch (err){
    res.status(500).json({error: String(err)});
  }
});

app.post('/contacts', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);

  try{
    const {company_id, name, role, email, linkedin_url, notes} = req.body;
    const auth = await pool.query('SELECT * FROM companies WHERE id = $1 AND user_id = $2',
      [company_id, userId]
    )
    if(auth.rows.length === 0){
      return res.status(404).json({error: 'Company not found'});
    }

    const result = await pool.query('INSERT INTO contacts (company_id, name, role, email, linkedin_url, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [company_id, name, role, email, linkedin_url, notes]
    );
    res.json(result.rows[0]);
  } catch (err : any){
    if(err.code === '23503'){
      return res.status(400).json({error: 'That company does not exist'});
    }
    res.status(500).json({error: String(err)});
  }
});

app.put('/contacts/:id', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const contactID = req.params.id;
    const {company_id, name, role, email, linkedin_url, notes} = req.body;

    const auth = await pool.query('SELECT contacts.id FROM contacts JOIN companies ON contacts.company_id = companies.id WHERE companies.user_id = $1 AND contacts.id = $2',
      [userId, contactID]
    )
    if(auth.rows.length === 0){
      return res.status(404).json({error: 'Contact not found'});
    }

    const companyIdAuth = await pool.query('SELECT * FROM companies WHERE user_id = $1 and id = $2',
      [userId, company_id]
    )
    if(companyIdAuth.rows.length === 0){
      return res.status(404).json({error: 'Company not found'});
    }

    const result = await pool.query('UPDATE contacts SET company_id = $1, name = $2, role = $3, email = $4, linkedin_url = $5, notes = $6 WHERE id = $7 RETURNING *',
      [company_id, name, role, email, linkedin_url, notes, contactID]  
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'Contact not found'});
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({error: String(err)});
  }
});

app.delete('/contacts/:id', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const contactID = req.params.id;

    const auth = await pool.query('SELECT contacts.id FROM contacts JOIN companies ON contacts.company_id = companies.id WHERE companies.user_id = $1 AND contacts.id = $2',
      [userId, contactID]
    )
    if(auth.rows.length === 0){
      return res.status(404).json({error:'Contact not found'})
    }
    const result = await pool.query('DELETE FROM contacts WHERE id = $1 RETURNING *',
      [contactID]
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'Contact not found'});
    }
    res.json(result.rows[0]);
  } catch (err){
    res.status(500).json({error: String(err)});
  }
});



app.get('/interview_stages', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const result = await pool.query('SELECT interview_stages.* FROM interview_stages JOIN applications ON interview_stages.application_id = applications.id JOIN companies ON applications.company_id = companies.id WHERE companies.user_id = $1',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({error: String(err)});
  }
});

app.get('/interview_stages/:id', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const interviewStagesId = req.params.id;
    const result = await pool.query('SELECT interview_stages.* FROM interview_stages JOIN applications ON interview_stages.application_id = applications.id JOIN companies ON applications.company_id = companies.id WHERE companies.user_id = $1 AND interview_stages.id = $2',
      [userId, interviewStagesId]
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'Interview stage not found'});
    }
    res.json(result.rows[0]);
  } catch (err){
    res.status(500).json({error: String(err)});
  }
});

app.post('/interview_stages', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const { application_id, stage_name, scheduled_date, completed, notes } = req.body;
    const completedValue = completed ?? false;

    const auth = await pool.query('SELECT applications.* FROM applications JOIN companies ON applications.company_id = companies.id WHERE applications.id = $1 AND companies.user_id = $2',
      [application_id, userId]
    );
    if(auth.rows.length === 0){
      return res.status(404).json({error:'Application not found'});
    }

    const result = await pool.query('INSERT INTO interview_stages (application_id, stage_name, scheduled_date, completed, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [application_id, stage_name, scheduled_date, completedValue, notes]
    );
    res.json(result.rows[0]);
  } catch (err : any){
    if(err.code === '23503'){
      return res.status(400).json({error: 'That application does not exist'});
    }
    res.status(500).json({error: String(err)});
  }
});

app.put('/interview_stages/:id', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const interviewStagesId = req.params.id;
    const {application_id, stage_name, scheduled_date, completed, notes} = req.body;

    const auth = await pool.query('SELECT interview_stages.id FROM interview_stages JOIN applications ON interview_stages.application_id = applications.id JOIN companies ON applications.company_id = companies.id WHERE interview_stages.id = $1 AND companies.user_id = $2',
      [interviewStagesId, userId]
    );
    if(auth.rows.length === 0){
      return res.status(404).json({error: 'Interview stage not found'});
    }

    const applicationIdAuth = await pool.query('SELECT applications.* FROM applications JOIN companies ON applications.company_id = companies.id WHERE applications.id = $1 AND companies.user_id = $2',
      [application_id, userId]
    );
    if(applicationIdAuth.rows.length === 0){
      return res.status(404).json({error: 'Application not found'});
    }

    const result = await pool.query('UPDATE interview_stages SET application_id = $1, stage_name = $2, scheduled_date = $3, completed = $4, notes = $5 WHERE id = $6 RETURNING *',
      [application_id, stage_name, scheduled_date, completed, notes, interviewStagesId]  
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'Interview stage not found'});
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({error: String(err)});
  }
});

app.delete('/interview_stages/:id', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const interviewStagesId = req.params.id;
    const auth = await pool.query('SELECT interview_stages.id FROM interview_stages JOIN applications ON interview_stages.application_id = applications.id JOIN companies ON applications.company_id = companies.id WHERE interview_stages.id = $1 and companies.user_id = $2',
      [interviewStagesId, userId]
    );
    if(auth.rows.length === 0){
      return res.status(404).json({error: 'Interview stage not found'});
    }

    const result = await pool.query('DELETE FROM interview_stages WHERE id = $1 RETURNING *',
      [interviewStagesId]
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'Interview stage not found'});
    }
    res.json(result.rows[0]);
  } catch (err){
    res.status(500).json({error: String(err)});
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
