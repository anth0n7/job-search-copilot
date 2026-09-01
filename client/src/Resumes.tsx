import { useState, useEffect } from 'react'
import { useApi } from './useApi'
import { useError } from './useError'
import type { Resume } from './types'
import { Check } from 'lucide-react';


function Resumes(){
    const apiFetch = useApi();
    const {setErrorMessage} = useError();
    const [resume, setResume] = useState< Resume | null>(null);
    const [resume_text, setResumeText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const hasUnsavedChanges = resume_text !== (resume?.resume_text ?? '');

    useEffect(() =>{
        apiFetch('/resumes')
        .then((data) => {
            setResume(data)
            setResumeText(data?.resume_text ?? '')
        })
        .catch((err) => {
            console.error("Failed to fetch resume: ", err)
            setErrorMessage(err.message);
        })
        .finally(() => setIsLoading(false));
    }, [])

    function handleSave(){
        apiFetch('/resumes', {
            method: 'PUT',
            headers: {'Content-Type' : 'application/json'},
            body: JSON.stringify({resume_text})
        })
        .then((text) => {
            setResume(text);
        })
        .catch((err) =>{console.error('Failed to fetch resume:', err);
                setErrorMessage(err.message);
            })
    }


    return(
        <div className="max-w-3xl mx-auto">
            <h1 className="page-title mb-4">Resume</h1>
            {isLoading ? (
                <div className="skeleton h-72" />
            ) : (
                <textarea id="resume_text" value={resume_text} className="input-field" rows={16} onChange={(e) => setResumeText(e.target.value)}></textarea>
            )}
             <div className="flex justify-end mt-3">
                <button disabled={!hasUnsavedChanges} className="btn-primary" onClick={() => handleSave()}>
                    <Check size={16} />
                    Save
                    </button>
             </div>
        </div>
    )
}

export default Resumes
