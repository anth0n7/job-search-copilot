import { useState, useEffect } from 'react'
import { useApi } from './useApi'
import { useError } from './useError'
import type { Suggestion } from './types'
import {Sparkles, Loader2} from 'lucide-react';

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
        <div className="mt-6 divider pt-4">
            <h1 className="section-title mb-2">Resume Suggestions &amp; Cover Letter Draft</h1>
            <div className="flex justify-center p-4">
                <button className="btn-primary" disabled={isGenerating} onClick={() => handleSuggestions()}>
                    {isGenerating === false ? <Sparkles size={16} /> : <Loader2 size={16} className="animate-spin" />}
                    {isGenerating === false ? "Generate Suggestions" : "Generating..."}
                </button>
            </div>
            {suggestions && (
                <div className="space-y-4">
                {suggestions.suggested_changes.map((change, index) =>(

                    <div key={index} className="card p-4">
                        <h2 className="section-title mb-3">Suggested Resume Change #{index + 1}</h2>
                        <div className="space-y-3">
                            <div>
                                <span className="font-medium">Original:</span>
                                <p className="muted">{change.original}</p>
                            </div>

                            <div>
                                <span className="font-medium">Suggested:</span>
                                <p>{change.suggested}</p>
                            </div>

                            <div>
                                <span className="font-medium">Reason:</span>
                                <p className="muted">{change.reason}</p>
                            </div>
                        </div>
                    </div>
                ))}

                    <div className="card p-4">
                        <h2 className="section-title mb-2">Cover Letter Draft</h2>
                        <p className="whitespace-pre-wrap">
                            {suggestions.cover_letter_draft}
                        </p>
                    </div>

                </div>

            )}

        </div>
    )
}

export default Suggestions
