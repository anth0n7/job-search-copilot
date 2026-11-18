DROP TABLE IF EXISTS interview_stages, contacts,
 applications, companies, job_postings, matches, suggestions CASCADE;

DROP TABLE IF EXISTS resumes;

CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES
  companies(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  job_posting_url TEXT,
  status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'applied', 'interviewing', 'rejected', 'offer')),
  application_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE contacts(
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES
  companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  linkedin_url TEXT,
  notes TEXT
);

CREATE TABLE interview_stages(
  id SERIAL PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES
  applications(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  scheduled_date TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE,
  notes TEXT
);

CREATE TABLE resumes (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  updated_at TIMESTAMP DEFAULT NOW(),
  resume_text TEXT
);

-- Postgres does not index foreign keys automatically; the ownership-check joins use these
CREATE INDEX companies_user_id_idx ON companies(user_id);
CREATE INDEX applications_company_id_idx ON applications(company_id);
CREATE INDEX contacts_company_id_idx ON contacts(company_id);
CREATE INDEX interview_stages_application_id_idx ON interview_stages(application_id);
