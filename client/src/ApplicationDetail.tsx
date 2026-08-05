import { useParams } from 'react-router'
import { useState, useEffect} from 'react'
import type { Application, Company } from './types'
import { useApi } from './useApi'
import { useError } from './useError'
import InterviewStages from './InterviewStages'
import ApplicationContacts from './ApplicationContacts'


interface ApplicationDetailsProp{
    companies: Company []    
}

function ApplicationDetail({companies}: ApplicationDetailsProp){
    //useParams - the hook that lets a component read whatever value is sitting in a routes dynamic segment (:id)
    //the obj key has to match the name you used in the route path - always returns a string
    const { id } = useParams();
    const [application, setApplication ] = useState<Application | null>(null);
    const apiFetch = useApi();
    const { setErrorMessage } = useError();
    //?. is used when application is null so the component doesn't crash. Handles the action before the fetch resolves
    const company = companies.find((c) => c.id === application?.company_id);

    useEffect(() => {
        apiFetch(`/applications/${id}`)
        .then((data) =>{setApplication(data)})
        .catch((err) => {console.error('Failed to fetch application: ', err);
            setErrorMessage(err.message);
        });
    }, [id]);

    //we need the condition because JSX runs before the data exists and the initial value is null
    return(
        <div className="flex justify-center">
            {application !== null && (
                <div className=" border-2 p-10 rounded-3xl max-w-2xl mx-auto min-h-96">
                    <h1 className="flex justify-center font-semibold">{application.role_title} at {company?.name}</h1>
                    
                    {company && (
                       <div className="mt-6 border-t pt-4">
                            <div className="flex gap-1">
                                <span className="font-medium">Company Website:</span>
                                <a href={company.website} className="text-sky-300 hover:underline">{company.website}</a>
                            </div>

                            <div className="mt-6 border-t pt-4">
                                <ApplicationContacts companyID={company.id} />
                            </div>
                        </div>
                    )}
                
                    <div className="mt-4 border-t flex gap-1 pt-4">
                        <span className="font-medium">Status:</span>
                        <p>{application.status}</p>
                    </div>

                    <div className="flex gap-1">
                        <span className="font-medium">Application Date:</span>
                        <p>{new Date(application.application_date).toLocaleDateString()}</p>
                    </div>

                    <div className="flex gap-1">
                        <span className="font-medium">Job URL:</span>
                        <a href = {application.job_posting_url} target="_blank" className="text-sky-300 hover:underline">{application.job_posting_url}</a>
                    </div>

                    <div className="mt-6 border-t pt-4">
                        <InterviewStages applicationID={application.id} />
                    </div>


                </div>

            )}
        </div>
    )
}

export default ApplicationDetail