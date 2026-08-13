export interface Company {
  id: number;
  name: string;
  website: string | null;
  notes: string | null;
  created_at: string;
}

export interface Application {
    id: number;
    company_id: number;
    role_title: string; 
    job_posting_url: string | null;
    status: string ;
    application_date: string;
    created_at: string;
    updated_at: string;
}

export interface Contact {
    id: number;
    company_id: number;
    name: string;
    role: string | null;
    email: string | null;
    linkedin_url: string | null;
    notes: string | null;
}

export interface InterviewStage {
    id: number;
    application_id: number;
    stage_name: string;
    scheduled_date: string | null;
    completed: boolean | null;
    notes: string | null;
}

export interface ParsedJobPostingData {
    seniority: string;
    required_skills: string[];
    responsibilities: string[];
}

export interface JobPosting {
    id: number;
    application_id: number;
    raw_text: string;
    created_at: string;
    parsed_data: ParsedJobPostingData | null;
}

export interface Match{
    id: number;
    application_id: number;
    score: number;
    matched_skills: string[];
    missing_skills: string[];
    resume_text_snapshot: string;
    created_at: string;
}