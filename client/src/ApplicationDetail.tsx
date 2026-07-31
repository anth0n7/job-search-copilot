import { useParams } from 'react-router'
import { useState, useEffect} from 'react'
import type { Application } from './types'
import { useApi } from './useApi'


function ApplicationDetail(){
    //useParams - the hook that lets a component read whatever value is sitting in a routes dynamic segment (:id)
    //the obj key has to match the name you used in the route path - always returns a string
    const { id } = useParams();
    const [application, setApplication ] = useState<Application | null>(null);
    const apiFetch = useApi();

    useEffect(() => {
        apiFetch(`/applications/${id}`)
        .then((data) =>{setApplication(data)})
        .catch((err) => {console.error('Failed to fetch application: ', err)});
    }, [id]);
    return(
        <div>
            <p>Application ID: {id}</p>
            {application === null && <p>Loading...</p>}
            {application !== null && <p>{application.role_title}</p>}
        </div>
    )
}

export default ApplicationDetail