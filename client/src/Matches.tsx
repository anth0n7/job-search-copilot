import { useState, useEffect } from 'react'
import { useApi } from './useApi'
import { useError } from './useError'
import type { Match } from './types'
import { Sparkles } from 'lucide-react';


interface MatchesProps{
    applicationID: number;
}

function Matches({applicationID} : MatchesProps){
    const apiFetch = useApi();
    const {setErrorMessage} = useError();
    const [matches, setMatches] = useState<Match[]>([])


    useEffect(() =>{
      apiFetch(`/applications/${applicationID}/matches`)
      .then((data) => {
        setMatches(data)
      }
    )
      .catch((err) => {console.error("Failed to fetch matches:", err)
        setErrorMessage(err.message);
      })
    }, [applicationID]);

    function handleMatches(){
        apiFetch(`/applications/${applicationID}/matches`, {
            method: 'POST',
        })
        .then((match) => {
            setMatches([match, ...matches]);
        })
        .catch((err) => {console.error("Failed to fetch match:", err)
        setErrorMessage(err.message);
      })
    }



    return(
        <div className="mt-6 divider pt-4">
        <h1 className="section-title mb-2">Matches</h1>
        <div className="space-y-3">
            {matches.slice(0,3).map((match) => (
                <div key={match.id} className="card p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <span className="font-medium shrink-0">Score:</span>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div className="bg-emerald-500 h-2 rounded-full" style={{width: `${Math.round(match.score * 100)}%`}}></div>
                        </div>
                        <p className="shrink-0 tabular-nums">{Math.round(match.score * 100)}%</p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="font-medium">Matched Skills:</span>
                        <p>{match.matched_skills.join(', ')}</p>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="font-medium">Missing Skills:</span>
                        <p>{match.missing_skills.join(', ')}</p>
                    </div>
                </div>
            ))}

        </div>

        <div className="flex justify-center mt-3">
            <button className="btn-primary" onClick={() => handleMatches()}>
              <Sparkles size={16} />
              Run Match
              </button>
        </div>

        </div>


    )
}

export default Matches
