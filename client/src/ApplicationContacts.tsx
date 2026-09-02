import { useState, useEffect } from 'react'
import type { Contact } from './types'
import { useApi } from './useApi'
import { useError } from './useError'
import { Users } from 'lucide-react';

interface ApplicationContactsProp{
    companyID: number;
}

function ApplicationContacts({companyID} : ApplicationContactsProp){
    const [contacts, setContact] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const apiFetch = useApi();
    const { setErrorMessage } = useError();
    useEffect(() =>{
        apiFetch(`/companies/${companyID}/contacts`)
        .then((data) =>{setContact(data)})
        .catch((err) => {console.error('Failed to fetch contact', err);
            setErrorMessage(err.message);
        })
        .finally(() => setIsLoading(false));
    }, [companyID]);


    //isLoading helps distinguish between "something is happening, wait", "No applications yet", and "showing the actual data"
    return(
        <div>
            <h1 className="section-title mb-2">Contacts</h1>

            {isLoading && <div className="skeleton h-16" />}

            {!isLoading && contacts.length === 0 && (
                <div className="text-center py-3">
                    <Users size={20} className="mx-auto text-slate-500 mb-1" />
                    <p className="muted text-sm">No contacts yet</p>
                </div>
            )}

            {!isLoading && contacts.length > 0 && (
                <div className="space-y-3">
                   {contacts.map((contact) => (
                    <div key={contact.id} className="card p-4 text-sm">
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
                            <a href={contact.linkedin_url ?? undefined} target="_blank" className="text-sky-300 hover:underline transition-colors duration-150">{contact.linkedin_url}</a>
                        </div>

                        <div className="flex gap-1">
                            <span className="font-medium">Notes:</span>
                            <p>{contact.notes}</p>
                        </div>
                    </div>
                   ))}
                </div>
            )}


        </div>
    )

}

export default ApplicationContacts
