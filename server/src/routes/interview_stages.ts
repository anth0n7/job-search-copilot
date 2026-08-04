import { Router } from 'express'
import { requireAuth } from '../middleware'
import { getAuth } from '@clerk/express'
import {pool} from '../db'

const router = Router()

router.get('/', requireAuth, async (req, res) =>{
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

router.get('/:id', requireAuth, async (req, res) =>{
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

router.post('/', requireAuth, async (req, res) =>{
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

router.put('/:id', requireAuth, async (req, res) =>{
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

router.delete('/:id', requireAuth, async (req, res) =>{
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

export default router;