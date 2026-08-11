import { useState, useEffect } from 'react'
import { useApi } from './useApi'
import { useError } from './useError'
import type { JobPosting } from './types'

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
        <div className="mt-6 border-t pt-4">
            <h1 className="flex justify-center font-semibold mb-2">Job Posting</h1>
            <textarea id="job_description" value={raw_text} className="bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 w-full" rows={8} onChange={(e) => setRawText(e.target.value)}></textarea>
            <div className="flex gap-2 justify-center mt-3 mb-3">
                <button disabled={!hasUnsavedChanges} className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => handleSave()}>Save</button>
                {job_posting != null && <button disabled={hasUnsavedChanges} className="px-4 py-2 bg-gray-700 text-sm font-medium text-gray-100 rounded-lg hover:bg-gray-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => handleParse()}>Parse Job Posting</button>}
            </div>
            {job_posting?.parsed_data && (
                <div className="flex flex-col gap-3">
                <h2 className="flex justify-center font-semibold mb-2">Parsed Data</h2>
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