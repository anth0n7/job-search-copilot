import { useState, useEffect } from 'react'
import { useApi } from './useApi'
import { useError } from './useError'
import type { Match } from './types'


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
        <div className="mt-6 border-t pt-4">
        <h1 className="flex justify-center font-semibold mb-2">Matches</h1>
        <div className="max-w-md mx-auto space-y-3">
            {matches.slice(0,3).map((match) => (
                <div key={match.id} className=" bg-gray-800 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="flex flex-col ">
                        <span className="font-medium">Score:</span>
                        <p>{Math.round(match.score * 100)}%</p>
                    </div>

                    <div className="flex flex-col ">
                        <span className="font-medium">Matched Skills:</span>
                        <p>{match.matched_skills.join(', ')}</p>
                    </div>

                    <div className="flex flex-col ">
                        <span className="font-medium">Missing Skills:</span>
                        <p>{match.missing_skills.join(', ')}</p>
                    </div>
                    </div>
                </div>
            ))}
            
        </div>

        <div className="flex justify-center mt-3">    
            <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400 cursor-pointer" onClick={() => handleMatches()}>Run Match</button>
        </div>

        </div>
       
    
    )
}

export default Matches