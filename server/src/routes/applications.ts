import { application, Router } from 'express'
import { requireAuth } from '../middleware'
import { getAuth } from '@clerk/express'
import {pool} from '../db'
import { parseJobPosting } from '../parseJobPosting'
import { getEmbedding } from '../getEmbedding';
import { cosineSimilarity } from '../similarity';
import { compareSkills } from '../compareSkills';

const router = Router();

//applications.* - give me every column, but only from applications (both talbes might have columns with the same name)
router.get('/', requireAuth, async (req, res) =>{
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
router.post('/', requireAuth, async (req, res) =>{
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
    res.status(500).json({error: String(err)});
  }
});

router.put('/:id', requireAuth, async(req, res) =>{
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
    res.status(500).json({error: String(err)});
  }
});

router.get('/:id/interview_stages', requireAuth, async(req, res) => {
  const { userId } = getAuth(req);

  try{
    const applicationID = req.params.id;
    const result = await pool.query('SELECT interview_stages.* FROM interview_stages JOIN applications ON interview_stages.application_id = applications.id JOIN companies ON applications.company_id = companies.id WHERE applications.id = $1 AND companies.user_id = $2',
      [applicationID, userId]
    );
    res.json(result.rows);
    } catch (err){
      res.status(500).json({error: String(err)});
  } 
});

router.put('/:id/job_postings', requireAuth, async (req, res) =>{
    const { userId } = getAuth(req);
    try{
        const applicationID = req.params.id;
        const { raw_text }  = req.body;
        const auth = await pool.query('SELECT applications.id FROM applications JOIN companies ON applications.company_id = companies.id WHERE applications.id = $1 AND companies.user_id = $2',
            [applicationID, userId]
        );
        if(auth.rows.length === 0){
            return res.status(404).json({error: 'Application not found'});
        }
        const result = await pool.query('INSERT INTO job_postings (application_id, raw_text) VALUES ($1, $2) ON CONFLICT (application_id) DO UPDATE SET raw_text = $2 RETURNING *',
            [applicationID, raw_text]
        )
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({error: String(err)});
    }
});

//we use parse to differentiate that this route doesn't create anything, but triggers a process to transform existing data
router.post('/:id/job_postings/parse', requireAuth, async(req, res) =>{
    const { userId } = getAuth(req);
    const applicationID = req.params.id;

    try{
        const auth = await pool.query('SELECT applications.id FROM applications JOIN companies ON applications.company_id = companies.id WHERE applications.id = $1 AND companies.user_id = $2',
            [applicationID, userId]
        )
        if(auth.rows.length === 0){
            return res.status(404).json({error: 'Application not found'});
        }

        const raw_text = await pool.query('SELECT job_postings.raw_text FROM job_postings WHERE job_postings.application_id = $1',
            [applicationID]
        );
        if(raw_text.rows.length === 0){
            return res.status(400).json({error:'raw text not found'});
        }

        const parsed_data = await parseJobPosting(raw_text.rows[0].raw_text);
        
        const result = await pool.query('UPDATE job_postings SET parsed_data = $1 WHERE application_id = $2 RETURNING *',
            [JSON.stringify(parsed_data), applicationID]
        );

        res.json(result.rows[0]);

    } catch (err) {
        res.status(500).json({error: String(err)});
    }
});

router.get('/:id/job_postings', requireAuth, async(req, res) => {
    const { userId } = getAuth(req);
    const applicationID = req.params.id;
    try{
        const result = await pool.query('SELECT job_postings.* FROM job_postings JOIN applications ON job_postings.application_id = applications.id JOIN companies ON applications.company_id = companies.id WHERE companies.user_id = $1 AND applications.id = $2',
            [userId, applicationID]
        );
        if (result.rows.length === 0){
            return res.json(null);
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({error: String(err)});
    }
});

router.get('/:id/matches', requireAuth, async (req, res) =>{
    const { userId } = getAuth(req);
    const applicationID = req.params.id;
    try{
        const result = await pool.query('SELECT matches.* FROM matches JOIN applications ON matches.application_id = applications.id JOIN companies ON applications.company_id = companies.id WHERE applications.id = $1 and companies.user_id = $2 ORDER BY matches.created_at DESC',
            [applicationID, userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({error: String(err)});
    }
});

router.post('/:id/matches', requireAuth, async (req, res) =>{
    const { userId } = getAuth(req);
    const applicationID = req.params.id
    try{
        const auth = await pool.query('SELECT applications.* FROM applications JOIN companies ON applications.company_id = companies.id WHERE applications.id = $1 AND companies.user_id = $2',
            [applicationID, userId]
        );
        if(auth.rows.length === 0){
            return res.status(404).json({error:'Application not found'});
        }
        
        const resumeQuery = await pool.query('SELECT resumes.resume_text FROM resumes WHERE user_id = $1',
            [userId]
        );
        if(resumeQuery.rows.length === 0){
            return res.status(400).json({error:'Resume not found'});
        }

        const job_posting = await pool.query('SELECT job_postings.* FROM job_postings WHERE job_postings.application_id = $1',
            [applicationID]
        )
        if(job_posting.rows.length === 0){
            return res.status(400).json({error:'No job postings exist'})
        }

        const jobPostingRawText = job_posting.rows[0].raw_text;
        const jobPostingParsedData = job_posting.rows[0].parsed_data;
        const resumeTextSnapshot = resumeQuery.rows[0].resume_text;
        const resumeEmbedding = await getEmbedding(resumeTextSnapshot)
        const rawTextEmbedding = await getEmbedding(jobPostingRawText);
        const similarityScore = cosineSimilarity(resumeEmbedding, rawTextEmbedding);

        let matchedSkills: string[] = [];
        let missingSkills: string[] = [];

        if(jobPostingParsedData){
          const comparedSkills = await compareSkills(resumeTextSnapshot, jobPostingParsedData.required_skills)
          matchedSkills = comparedSkills.matched_skills;
          missingSkills = comparedSkills.missing_skills;
        }

        const result = await pool.query('INSERT INTO matches (score, matched_skills, missing_skills, application_id, resume_text_snapshot) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [similarityScore, matchedSkills, missingSkills, applicationID, resumeTextSnapshot]
        );
        res.json(result.rows[0]);
    } catch (err : any){
    if(err.code === '23503'){
      return res.status(400).json({error: 'That application does not exist'});
    }
        res.status(500).json({error: String(err)});
    }
});

router.put('/:id/suggestions', requireAuth, async (req, res) =>{
    const { userId } = getAuth(req);
    try{
        const applicationID = req.params.id;
        const { cover_letter_draft, suggested_changes }  = req.body;
        const auth = await pool.query('SELECT applications.id FROM applications JOIN companies ON applications.company_id = companies.id WHERE applications.id = $1 AND companies.user_id = $2',
            [applicationID, userId]
        );
        if(auth.rows.length === 0){
            return res.status(404).json({error: 'Application not found'});
        }
        const result = await pool.query('INSERT INTO suggestions (application_id, cover_letter_draft, suggested_changes) VALUES ($1, $2, $3) ON CONFLICT (application_id) DO UPDATE SET cover_letter_draft = $2, suggested_changes = $3 RETURNING *',
            [applicationID, cover_letter_draft, JSON.stringify(suggested_changes)]
        )
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({error: String(err)});
    }
});


router.get('/:id/suggestions', requireAuth, async(req, res) => {
    const { userId } = getAuth(req);
    const applicationID = req.params.id;
    try{
        const result = await pool.query('SELECT suggestions.* FROM suggestions JOIN applications ON suggestions.application_id = applications.id JOIN companies ON applications.company_id = companies.id WHERE companies.user_id = $1 AND applications.id = $2',
            [userId, applicationID]
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