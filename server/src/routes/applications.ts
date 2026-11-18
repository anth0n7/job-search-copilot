import { Router } from 'express'
import { requireAuth } from '../middleware'
import { getAuth } from '@clerk/express'
import {pool} from '../db'
import { sendServerError, isBlank } from '../errors'

const router = Router();

//applications.* - give me every column, but only from applications (both talbes might have columns with the same name)
router.get('/', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const result = await pool.query('SELECT applications.* FROM applications JOIN companies ON applications.company_id = companies.id WHERE companies.user_id = $1 ORDER BY applications.id DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

//first query to verify company id actually belongs to the user
router.post('/', requireAuth, async (req, res) =>{
  const { userId } = getAuth(req);
  try{
    const {company_id, role_title, job_posting_url, status, application_date} = req.body;
    if(isBlank(role_title)){
      return res.status(400).json({error: 'Role title is required'});
    }
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
    sendServerError(res, err);
  }
});

//404 is good here because it doesn't reveal "exists but not yours"
router.get('/:id', requireAuth, async (req, res) =>{
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
    sendServerError(res, err);
  }
});

router.put('/:id', requireAuth, async(req, res) =>{
  const { userId } = getAuth(req);
  try{
    const {company_id, role_title, job_posting_url, status, application_date} = req.body;
    const applicationID = req.params.id;
    if(isBlank(role_title)){
      return res.status(400).json({error: 'Role title is required'});
    }
    
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
    const result = await pool.query('UPDATE applications SET company_id = $1, role_title = $2, job_posting_url = $3, status = $4, application_date = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
      [company_id, role_title, job_posting_url, status, application_date, applicationID]
    );
    if(result.rows.length === 0){
      return res.status(404).json({error: 'Application not found'});
    }
    res.json(result.rows[0]);
  } catch (err) {
    sendServerError(res, err);
  }
});

router.delete('/:id', requireAuth, async (req, res) =>{
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
    sendServerError(res, err);
  }
});

router.get('/:id/interview_stages', requireAuth, async(req, res) => {
  const { userId } = getAuth(req);

  try{
    const applicationID = req.params.id;
    const result = await pool.query('SELECT interview_stages.* FROM interview_stages JOIN applications ON interview_stages.application_id = applications.id JOIN companies ON applications.company_id = companies.id WHERE applications.id = $1 AND companies.user_id = $2 ORDER BY interview_stages.id DESC',
      [applicationID, userId]
    );
    res.json(result.rows);
    } catch (err){
      sendServerError(res, err);
  } 
});

export default router;