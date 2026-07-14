DROP TABLE IF EXISTS interview_stages, contacts,
 applications, companies CASCADE;

CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
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
  status TEXT NOT NULL DEFAULT 'saved',
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
  scheduled_date TIMESTAMP,
  completed BOOLEAN DEFAULT FALSE,
  notes TEXT
);