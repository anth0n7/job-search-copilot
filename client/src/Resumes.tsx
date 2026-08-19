import { useState, useEffect } from 'react'
import { useApi } from './useApi'
import { useError } from './useError'
import type { Resume } from './types'

function Resumes(){
    const apiFetch = useApi();
    const {setErrorMessage} = useError();
    const [resume, setResume] = useState< Resume | null>(null);
    const [resume_text, setResumeText] = useState('');
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
        <div>
            <h1 className="flex justify-center font-semibold mb-2">Resume</h1>
             <textarea id="resume_text" value={resume_text} className="bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500 w-full px-3 py-2" rows={12} onChange={(e) => setResumeText(e.target.value)}></textarea>
             <div className=" flex justify-center mt-3">
                <button disabled={!hasUnsavedChanges} className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => handleSave()}>Save</button>
             </div>
        </div>
    )
}

export default Resumes