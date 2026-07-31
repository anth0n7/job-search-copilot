import { useState, useEffect } from 'react'
import type { Company, Contact } from './types';
import { useApi } from './useApi'

interface ContactsProps{
    companies: Company[]
}



function Contacts({companies}: ContactsProps){
    const [contacts , setContacts] = useState<Contact[]>([]);
    const [company_id, setCompanyId] = useState<number | null>(null);
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [email, setEmail] = useState('');
    const [linkedin_url, setLinkedinUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const apiFetch = useApi();

    useEffect(() =>{
        apiFetch('/contacts')
        .then((data) =>{setContacts(data)})
        .catch((err) => {console.error('Failed to fetch contacts', err)})
    }, []);

    function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
        e.preventDefault();
        if(editingId !== null){
            apiFetch(`/contacts/${editingId}`,{
                method: 'PUT',
                headers: {'Content-Type' : 'application/json'},
                body: JSON.stringify({name, role, email, linkedin_url, notes, company_id})
            })
            .then((editedContact) =>{
                setContacts(contacts.map((currentContact) =>(
                    currentContact.id === editingId ? editedContact : currentContact
                )));
            })
            .catch((err) =>{console.error('Failed to fetch contact:', err)})
        }
        else{
            apiFetch(`/contacts`, {
                method: 'POST',
                headers: {'Content-Type' : 'application/json'},
                body: JSON.stringify({name, role, email, linkedin_url, notes, company_id})
            })
            .then((contact) =>{setContacts([contact, ...contacts])})
            .catch((err) =>{console.error('Failed to fetch contact:', err)})
        }
        setCompanyId(null);
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
        .catch((err) =>{console.error('Failed to fetch contact:', err)})
    }

    function handleEdit(editedContact: Contact){
        setCompanyId(editedContact.company_id);
        setEmail(editedContact.email ?? '');
        setLinkedinUrl(editedContact.linkedin_url ?? '');
        setEditingId(editedContact.id);
        setRole(editedContact.role ?? '');
        setNotes(editedContact.notes ?? '');
        setName(editedContact.name);
    }

    function handleCancel(){
        setCompanyId(null);
        setEmail('');
        setLinkedinUrl('');
        setEditingId(null);
        setRole('');
        setNotes('');
        setName('');
    }




    return(
        <div className="mb-5">
            <ul className="max-w-md mx-auto space-y-2">
              {contacts.map((contact) =>(
                <li className="flex items-center justify-between bg-gray-800 rounded-lg p-4" key={contact.id}>{contact.name}
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-rose-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-rose-400" onClick={() => handleDelete(contact.id)}>Delete</button>
                    <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400" onClick={() => handleEdit(contact)}>Edit</button>
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

                <label htmlFor="company_id" className="block text-sm font-medium text-gray-300 mb-1">Company</label>
                <select id="company_id" className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" value={company_id ?? ''} onChange={(e) => setCompanyId(Number(e.target.value))} required>
                <option value="" disabled>Select a company...</option> 
                {companies.map((company) =>(
                    <option key={company.id} value={company.id}>{company.name}</option>
                ))}
                </select>
                <div className="flex justify-center gap-2">
                    <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400" type="submit">{editingId === null ? "Add Contact" : "Save Changes"}</button> 
                    {editingId !== null && <button className="px-4 py-2 bg-gray-700 text-sm font-medium text-gray-100 rounded-lg hover:bg-gray-600" type="button" onClick={() => handleCancel()}>Cancel</button>}
                </div>
            </form>
            
        </div>
    )
}

export default Contacts