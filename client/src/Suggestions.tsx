import { useState, useEffect } from 'react'
import { useApi } from './useApi'
import { useError } from './useError'
import type { Suggestion } from './types'

interface SuggestionProps{
    applicationID: number;
}

function Suggestions({applicationID}: SuggestionProps){
    const apiFetch = useApi();
    const {setErrorMessage} = useError();    
    const [suggestions, setSuggestions] = useState<Suggestion | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() =>{
        apiFetch(`/applications/${applicationID}/suggestions`)
        .then((data) => {
            setSuggestions(data)           
        })
        .catch((err) => {console.error("Failed to fetch suggestion:", err)
            setErrorMessage(err.message);
        })   
    }, [applicationID]);

    function handleSuggestions(){
        setIsGenerating(true);
        apiFetch(`/applications/${applicationID}/suggestions/generate`, {
            method: 'POST',   
        })
        .then((suggestion) => {
            setSuggestions(suggestion)
        })
        .catch((err) =>{console.error('Failed to fetch suggestion:', err);
            setErrorMessage(err.message);
        })
        .finally(() => {
            setIsGenerating(false);
        })
    }


    return(
        <div className="mt-6 border-t pt-4">
            <h1 className="flex justify-center font-semibold mb-2">Resume Suggestions and Cover Letter Draft</h1>
            <div className="flex justify-center p-4">
                <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" disabled={isGenerating} onClick={() => handleSuggestions()}>{isGenerating === false ? "Generate Suggestions" : "Generating..."}</button> 
            </div>
            {suggestions && (
                <div>
                {suggestions.suggested_changes.map((change, index) =>(
                    
                    <div key={index} className="bg-gray-800 p-4 rounded-lg mb-5">
                        <h2 className="flex justify-center font-medium">Suggested Resume Change #{index + 1}</h2>
                        <div className="p-4">
                            <span className="font-medium">Original:</span>
                            <p>{change.original}</p>
                        </div>

                        <div className="p-4">
                            <span className="font-medium">Suggested:</span>
                            <p>{change.suggested}</p>
                        </div>     

                        <div className="p-4">
                            <span className="font-medium">Reason:</span>
                            <p>{change.reason}</p>
                        </div>
                    </div>
                ))}

                    <div className="bg-gray-800 rounded-lg p-4">
                        <h1 className="flex justify-center font-semibold mb-2">Cover Letter Draft</h1>
                        <p>
                            {suggestions.cover_letter_draft}
                        </p>
                    </div>
                
                </div>
                
            )}

        </div>
    )
}

export default Suggestions