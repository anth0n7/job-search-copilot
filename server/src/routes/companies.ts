import { Router } from 'express'
import { requireAuth } from '../middleware'
import { getAuth } from '@clerk/express'
import {pool} from '../db'

const router = Router();

router.get('/', requireAuth, async (req, res) =>{
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
router.post('/', requireAuth, async (req, res) =>{
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

router.get('/:id', requireAuth, async (req, res) =>{
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
router.put('/:id', requireAuth, async (req, res) =>{
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

router.delete('/:id', requireAuth, async (req, res) =>{
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

router.get('/:id/contacts', requireAuth, async(req, res) => {
    const { userId } = getAuth(req);
    try{
        const companyID = req.params.id;
        const result = await pool.query('SELECT contacts.* FROM contacts JOIN companies ON contacts.company_id = companies.id WHERE companies.id = $1 AND companies.user_id = $2',
            [companyID, userId]
        );
        res.json(result.rows)
    } catch (err) {
        res.status(500).json({error: String(err)});
    }
});

export default router;