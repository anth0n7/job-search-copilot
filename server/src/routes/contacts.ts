import { Router } from 'express'
import { requireAuth } from '../middleware'
import { getAuth } from '@clerk/express'
import {pool} from '../db'

const router = Router()

router.get('/', requireAuth, async (req, res) =>{
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

router.get('/:id', requireAuth, async (req, res) =>{
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

router.post('/', requireAuth, async (req, res) =>{
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

router.put('/:id', requireAuth, async (req, res) =>{
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

router.delete('/:id', requireAuth, async (req, res) =>{
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

export default router;