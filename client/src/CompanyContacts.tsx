import { useState, useEffect } from 'react'
import type { Contact } from './types';
import { useApi } from './useApi'
import { useError } from './useError'
import { Trash2, Pencil, Plus, Check, X} from 'lucide-react';

interface ContactsProps{
    companyID: number;
}



function CompanyContacts({companyID}: ContactsProps){
    const [contacts , setContacts] = useState<Contact[]>([]);
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [email, setEmail] = useState('');
    const [linkedin_url, setLinkedinUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const apiFetch = useApi();
    const {setErrorMessage} = useError();

    useEffect(() =>{
        apiFetch(`/companies/${companyID}/contacts`)
        .then((data) =>{setContacts(data)})
        .catch((err) => {console.error('Failed to fetch contacts', err);
            setErrorMessage(err.message);
        })
    }, [companyID]);

    function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
        e.preventDefault();
        if(editingId !== null){
            apiFetch(`/contacts/${editingId}`,{
                method: 'PUT',
                headers: {'Content-Type' : 'application/json'},
                body: JSON.stringify({name, role, email, linkedin_url, notes, company_id: companyID})
            })
            .then((editedContact) =>{
                setContacts(contacts.map((currentContact) =>(
                    currentContact.id === editingId ? editedContact : currentContact
                )));
            })
            .catch((err) =>{console.error('Failed to fetch contact:', err);
                setErrorMessage(err.message);
            })
        }
        else{
            apiFetch(`/contacts`, {
                method: 'POST',
                headers: {'Content-Type' : 'application/json'},
                body: JSON.stringify({name, role, email, linkedin_url, notes, company_id: companyID})
            })
            .then((contact) =>{setContacts([contact, ...contacts])})
            .catch((err) =>{console.error('Failed to fetch contact:', err);
                setErrorMessage(err.message);
            })
        }
        setEmail('');
        setLinkedinUrl('');
        setEditingId(null);
        setRole('');
        setNotes('');
        setName('');
    }

    function handleDelete(deletedId: number){
        apiFetch(`/contacts/${deletedId}`,{
            method: 'DELETE'
        })
        .then(() =>{
            setContacts(contacts.filter((currentContact) => currentContact.id !== deletedId));  
            if (editingId === deletedId){
                setEditingId(null);
            }
        })
        .catch((err) =>{console.error('Failed to fetch contact:', err);
            setErrorMessage(err.message);
        })
    }

    function handleEdit(editedContact: Contact){
        setEmail(editedContact.email ?? '');
        setLinkedinUrl(editedContact.linkedin_url ?? '');
        setEditingId(editedContact.id);
        setRole(editedContact.role ?? '');
        setNotes(editedContact.notes ?? '');
        setName(editedContact.name);
    }

    function handleCancel(){
        setEmail('');
        setLinkedinUrl('');
        setEditingId(null);
        setRole('');
        setNotes('');
        setName('');
    }




    return(
        <div className="mt-6 border-t pt-4">
            <h1 className="flex justify-center font-medium mb-2">Contacts</h1>
            <ul className="max-w-md mx-auto space-y-2">
              {contacts.map((contact) =>(
                <li className="flex items-center justify-between bg-gray-800 rounded-lg p-4" key={contact.id}>
                    <div className="flex flex-col gap-1">
                        <div className="flex gap-1">
                            <span className="font-medium">Name:</span>
                            <p>{contact.name}</p>
                        </div>
                        
                        <div className="flex gap-1">
                            <span className="font-medium">Role:</span>
                            <p>{contact.role}</p>
                        </div>

                        <div className="flex gap-1">
                            <span className="font-medium">Email:</span>
                            <p>{contact.email}</p>
                        </div>

                        <div className="flex gap-1">
                            <span className="font-medium">LinkedIn:</span>
                            <p>{contact.linkedin_url}</p>
                        </div>

                        <div className="flex gap-1">
                            <span className="font-medium">Notes:</span>
                            <p>{contact.notes}</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <button className="flex items-center gap-1 px-4 py-2 bg-rose-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-rose-400" onClick={() => handleDelete(contact.id)}>
                            <Trash2 size={16} />
                            Delete
                            </button>
                        <button className="flex items-center gap-1 px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400" onClick={() => handleEdit(contact)}>
                            <Pencil size={16} />
                            Edit
                        </button>
                    </div>
                </li>  
              ))}
            </ul>

            <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-gray-800 rounded-lg p-4 mt-4 space-y-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="name" value={name} onChange={(e) => setName(e.target.value)}/>

                <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="role" value={role} onChange={(e) => setRole(e.target.value)}/>

                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="email" value={email} type="email" onChange={(e) => setEmail(e.target.value)}/>

                <label htmlFor="linkedin_url" className="block text-sm font-medium text-gray-300 mb-1">LinkedIn URL</label>
                <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="linkedin_url" value={linkedin_url} type="url" onChange={(e) => setLinkedinUrl(e.target.value)}/>

                <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}/>

                <div className="flex justify-center gap-2">
                    <button className="flex items-center gap-1 px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400" type="submit">
                        {editingId === null ? <Plus size={16} />: <Check size={16} />}
                        {editingId === null ? "Add Contact" : "Save Changes"}
                    </button> 
                    {editingId !== null && <button className="flex items-center gap-1 px-4 py-2 bg-gray-700 text-sm font-medium text-gray-100 rounded-lg hover:bg-gray-600" type="button" onClick={() => handleCancel()}>
                        <X size={16} />
                        Cancel
                        </button>}
                </div>
            </form>
            
        </div>
    )
}

export default CompanyContacts