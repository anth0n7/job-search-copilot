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