import { Router } from 'express'
import { requireAuth } from '../middleware'
import { getAuth } from '@clerk/express'
import {pool} from '../db'

const router = Router();

router.put('/', requireAuth, async(req, res) =>{
    const { userId }  = getAuth(req);
    const { resume_text } = req.body;
    try{
        const result = await pool.query('INSERT INTO resumes (user_id, resume_text) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET resume_text = $2, updated_at = NOW() RETURNING *',
            [userId, resume_text]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({error: String(err)});    
    }
});

router.get('/', requireAuth, async(req, res) =>{
    const { userId }  = getAuth(req);
    try{
        const result = await pool.query('SELECT * FROM resumes WHERE resumes.user_id = $1',
            [userId]
        );
        if (result.rows.length === 0){
            return res.json(null);
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({error: String(err)});    
    }
});

export default router;