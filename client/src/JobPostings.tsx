import { useState, useEffect } from 'react'
import { useApi } from './useApi'
import { useError } from './useError'
import type { JobPosting } from './types'
import { Check, Sparkles} from 'lucide-react';

interface JobPostingProps{
    applicationID: number;
}

function JobPostings({applicationID} : JobPostingProps){
    const apiFetch = useApi();
    const {setErrorMessage} = useError();
    const [job_posting, setJobPosting] = useState<JobPosting | null>(null);
    const [raw_text, setRawText] = useState('');
    const hasUnsavedChanges = raw_text !== (job_posting?.raw_text ?? '');

    useEffect(() =>{
      apiFetch(`/applications/${applicationID}/job_postings`)
      .then((data) => {
        setJobPosting(data)
        //?. stops crash if raw text is null don't attempt to read and set the string to an empty string
        setRawText(data?.raw_text ?? '')
      }
    )
      .catch((err) => {console.error("Failed to fetch job posting:", err)
        setErrorMessage(err.message);
      })
    }, [applicationID]);

    function handleSave(){
        apiFetch(`/applications/${applicationID}/job_postings`, {
            method: 'PUT',
            headers: {'Content-Type' : 'application/json'},
            body: JSON.stringify({raw_text})
        })
        .then((posting) => {
            setJobPosting(posting)
        })
        .catch((err) =>{console.error('Failed to fetch job posting:', err);
                setErrorMessage(err.message);
            })
    }

    function handleParse(){
        apiFetch(`/applications/${applicationID}/job_postings/parse`, {
            method: 'POST',
        })
        .then((posting) => {
            setJobPosting(posting)
        })
        .catch((err) =>{console.error('Failed to fetch job posting:', err);
                setErrorMessage(err.message);
            })
    }

    return(
        <div className="mt-6 divider pt-4">
            <h1 className="section-title mb-2">Job Posting</h1>
            <textarea id="job_description" value={raw_text} className="input-field" rows={8} onChange={(e) => setRawText(e.target.value)}></textarea>
            <div className="flex gap-2 mt-3 mb-3">
                <button disabled={!hasUnsavedChanges} className="btn-primary" onClick={() => handleSave()}>
                    <Check size={16} />
                    Save
                </button>

                {job_posting != null && <button disabled={hasUnsavedChanges} className="btn-secondary" onClick={() => handleParse()}>
                    <Sparkles size={16} />
                    Parse Job Posting
                </button>}
            </div>
            {job_posting?.parsed_data && (
                <div className="card p-4 space-y-3">
                <h2 className="section-title">Parsed Data</h2>
                    <div className="flex gap-1">
                        <span className="font-medium">Seniority:</span>
                        <p>{job_posting.parsed_data.seniority}</p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="font-medium">Required Skills:</span>
                        <p>{job_posting.parsed_data.required_skills.join(", ")}</p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="font-medium">Responsibilities:</span>
                        <p>{job_posting.parsed_data.responsibilities.join(", ")}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default JobPostings
