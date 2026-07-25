import { useState, useEffect } from 'react'
import type { Company, Contact } from './types';

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

    useEffect(() =>{
        fetch('http://localhost:3001/contacts')
        .then((response) =>{
            if(!response.ok){
              throw new Error('Response failed');
            }
            return response.json();       
        })
        .then((data) =>{
            setContacts(data);
        })
        .catch((err) => {
            console.error('Failed to fetch contacts', err);
        })
    }, []);

    function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
        e.preventDefault();
        if(editingId !== null){
            fetch(`http://localhost:3001/contacts/${editingId}`,{
                method: 'PUT',
                headers: {'Content-Type' : 'application/json'},
                body: JSON.stringify({name, role, email, linkedin_url, notes, company_id})
            })
            .then((response) =>{
                if(!response.ok){
                    throw new Error('Response failed');
                }
                return response.json();
            })
            .then((editedContact) =>{
               setContacts(contacts.map((currentContact) =>(
                currentContact.id === editingId ? editedContact : currentContact
               ))); 
            })
            .catch((err) =>{
                console.error('Failed to fetch contact:', err);
            })
        }
        else{
            fetch('http://localhost:3001/contacts', {
                method: 'POST',
                headers: {'Content-Type' : 'application/json'},
                body: JSON.stringify({name, role, email, linkedin_url, notes, company_id})
            })
            .then((response) =>{
                if(!response.ok){
                    throw new Error('Response failed');
                }
                return response.json();
            })    
            .then((contact) =>{
                setContacts([contact, ...contacts]);
            })
            .catch((err) =>{
                console.error('Failed to fetch contact:', err);
            })
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
        fetch(`http://localhost:3001/contacts/${deletedId}`,{
            method: 'DELETE',
        })
        .then((response) =>{
            if(!response.ok){
                throw new Error('Request failed');
            }
            return response.json();
        })
        .then(() =>{
          setContacts(contacts.filter((currentContact) => currentContact.id !== deletedId));  
          if (editingId === deletedId){
            setEditingId(null);
          }
        })
        .catch((err) =>{
           console.error('Failed to fetch contact:', err); 
        })
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
        <div>
            <ul>
              {contacts.map((contact) =>(
                <li key={contact.id}>{contact.name}
                <button onClick={() => handleDelete(contact.id)}>Delete</button>
                <button onClick={() => handleEdit(contact)}>Edit</button>
                </li>  
              ))}
            </ul>

            <form onSubmit={handleSubmit}>
              <label htmlFor="name">Name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)}/>

            <label htmlFor="role">Role</label>
            <input id="role" value={role} onChange={(e) => setRole(e.target.value)}/>

            <label htmlFor="email">Email</label>
            <input id="email" value={email} type="email" onChange={(e) => setEmail(e.target.value)}/>

            <label htmlFor="linkedin_url">LinkedIn URL</label>
            <input id="linkedin_url" value={linkedin_url} type="url" onChange={(e) => setLinkedinUrl(e.target.value)}/>

            <label htmlFor="notes">Notes</label>
            <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}/>

            <select value={company_id ?? ''} onChange={(e) => setCompanyId(Number(e.target.value))} required>
               <option value="" disabled>Select a company...</option> 
               {companies.map((company) =>(
                <option key={company.id} value={company.id}>{company.name}</option>
               ))}
            </select>

            <button type="submit">{editingId === null ? "Add Contact" : "Save Changes"}</button> 

            {editingId !== null && <button type="button" onClick={() => handleCancel()}>Cancel</button>}
            </form>
            
        </div>
    )
}

export default Contacts