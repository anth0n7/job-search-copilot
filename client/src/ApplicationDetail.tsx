import { useParams } from 'react-router'
import { useState, useEffect} from 'react'
import type { Application } from './types'
import { useAuth } from '@clerk/react'


function ApplicationDetail(){
    //useParams - the hook that lets a component read whatever value is sitting in a routes dynamic segment (:id)
    //the obj key has to match the name you used in the route path - always returns a string
    const { id } = useParams();
    const { getToken } = useAuth();
    const [application, setApplication ] = useState<Application | null>(null);
    

    useEffect(() => {
        getToken().then((token) => {
            fetch(`http://localhost:3001/applications/${id}`, {
                headers: {Authorization: `Bearer ${token}`},
            })
            .then((response) => {
              if(!response.ok){
                throw new Error('Response failed');
              }  
                return response.json();
            })
            .then((data) =>{
                setApplication(data);
            })
            .catch((err) => {
                console.error('Failed to fetch application: ', err);
            })
        });   
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