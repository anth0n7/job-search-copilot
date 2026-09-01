import { useState, useEffect } from 'react'
import type { Contact } from './types';
import { useApi } from './useApi'
import { useError } from './useError'
import { Trash2, Pencil, Plus, Check, X, Users} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

interface ContactsProps{
    companyID: number;
}



function CompanyContacts({companyID}: ContactsProps){
    const [contacts , setContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [email, setEmail] = useState('');
    const [linkedin_url, setLinkedinUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const apiFetch = useApi();
    const {setErrorMessage} = useError();

    useEffect(() =>{
        apiFetch(`/companies/${companyID}/contacts`)
        .then((data) =>{setContacts(data)})
        .catch((err) => {console.error('Failed to fetch contacts', err);
            setErrorMessage(err.message);
        })
        .finally(() => setIsLoading(false));
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
        .finally(() => setPendingDeleteId(null));
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
        <div className="divider pt-4">
            <h1 className="section-title mb-2">Contacts</h1>

            {isLoading && <div className="skeleton h-16" />}

            {!isLoading && contacts.length === 0 && (
                <div className="text-center py-3">
                    <Users size={20} className="mx-auto text-slate-500 mb-1" />
                    <p className="muted text-sm">No contacts yet</p>
                </div>
            )}

            {!isLoading && contacts.length > 0 && (
                <ul className="space-y-2">
                  {contacts.map((contact) =>(
                    <li className="card flex items-center justify-between p-4" key={contact.id}>
                        <div className="flex flex-col gap-1 text-sm">
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
                            <button className="btn-danger" onClick={() => setPendingDeleteId(contact.id)}>
                                <Trash2 size={16} />
                                Delete
                                </button>
                            <button className="btn-primary" onClick={() => handleEdit(contact)}>
                                <Pencil size={16} />
                                Edit
                            </button>
                        </div>
                    </li>
                  ))}
                </ul>
            )}

            <form onSubmit={handleSubmit} className="card p-4 mt-4 space-y-4">
                <label htmlFor="name" className="form-label">Name</label>
                <input className="input-field" id="name" value={name} onChange={(e) => setName(e.target.value)}/>

                <label htmlFor="role" className="form-label">Role</label>
                <input className="input-field" id="role" value={role} onChange={(e) => setRole(e.target.value)}/>

                <label htmlFor="email" className="form-label">Email</label>
                <input className="input-field" id="email" value={email} type="email" onChange={(e) => setEmail(e.target.value)}/>

                <label htmlFor="linkedin_url" className="form-label">LinkedIn URL</label>
                <input className="input-field" id="linkedin_url" value={linkedin_url} type="url" onChange={(e) => setLinkedinUrl(e.target.value)}/>

                <label htmlFor="notes" className="form-label">Notes</label>
                <input className="input-field" id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}/>

                <div className="flex justify-end gap-2">
                    {editingId !== null && <button className="btn-secondary" type="button" onClick={() => handleCancel()}>
                        <X size={16} />
                        Cancel
                        </button>}
                    <button className="btn-primary" type="submit">
                        {editingId === null ? <Plus size={16} />: <Check size={16} />}
                        {editingId === null ? "Add Contact" : "Save Changes"}
                    </button>
                </div>
            </form>

            <ConfirmDialog
                open={pendingDeleteId !== null}
                title="Delete contact?"
                message="This will permanently remove this contact."
                onConfirm={() => pendingDeleteId !== null && handleDelete(pendingDeleteId)}
                onCancel={() => setPendingDeleteId(null)}
            />

        </div>
    )
}

export default CompanyContacts
