import { useState, useEffect } from 'react'
import type { Contact } from './types'
import { useApi } from './useApi'
import { useError } from './useError' 

interface ApplicationContactsProp{
    companyID: number;
}

function ApplicationContacts({companyID} : ApplicationContactsProp){
    const [contacts, setContact] = useState<Contact[]>([]);
    const apiFetch = useApi();
    const { setErrorMessage } = useError();
    useEffect(() =>{
        apiFetch(`/companies/${companyID}/contacts`)
        .then((data) =>{setContact(data)})
        .catch((err) => {console.error('Failed to fetch contact', err);
            setErrorMessage(err.message);
        });
    }, [companyID]);

    return(
        <div>
            <h1 className="font-semibold">Contacts:</h1>
            <div className="max-w-md mx-auto space-y-3">
               {contacts.map((contact) => (
                <div key={contact.id} className=" bg-gray-800 rounded-lg p-4">
                    <div className="flex gap-1">
                        <span className="font-medium">Name:</span>
                        <p> {contact.name}</p> 
                    </div>

                    <div className="flex gap-1">
                        <span className="font-medium">Role:</span>
                        <p> {contact.role}</p> 
                    </div>

                    <div className="flex gap-1">
                        <span className="font-medium">Email:</span>
                        <p>{contact.email}</p>
                    </div>        

                    <div className="flex gap-1">
                        <span className="font-medium">LinkedIn:</span>
                        <a href={contact.linkedin_url} target="_blank" className="text-sky-300 hover:underline">{contact.linkedin_url}</a>
                    </div>            

                    <div className="flex gap-1">
                        <span className="font-medium">Notes:</span>
                        <p>{contact.notes}</p>
                    </div>
                </div>
               ))} 
            </div>


        </div>
    )
    
}

export default ApplicationContacts