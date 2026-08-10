import { Router } from 'express'
import { requireAuth } from '../middleware'
import { getAuth } from '@clerk/express'
import {pool} from '../db'

const router = Router();

router.post('/', requireAuth, async (req, res) =>{
    const { userId } = getAuth(req);
    const { score, matched_skills, missing_skills, application_id } = req.body;
    try{
        const auth = await pool.query('SELECT applications.* FROM applications JOIN companies ON applications.company_id = companies.id WHERE applications.id = $1 AND companies.user_id = $2',
            [application_id, userId]
        );
        if(auth.rows.length === 0){
            return res.status(404).json({error:'Application not found'});
        }
        
        const resume_text_snapshot = await pool.query('SELECT resumes.resume_text FROM resumes WHERE user_id = $1',
            [userId]
        );
        if(resume_text_snapshot.rows.length === 0){
            return res.status(400).json({error:'resume not found'});
        }

        const result = await pool.query('INSERT INTO matches (score, matched_skills, missing_skills, application_id, resume_text_snapshot) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [score, matched_skills, missing_skills, application_id, resume_text_snapshot.rows[0].resume_text]
        );
        res.json(result.rows[0]);
    } catch (err : any){
    if(err.code === '23503'){
      return res.status(400).json({error: 'That application does not exist'});
    }
        res.status(500).json({error: String(err)});
    }
});



export default router;