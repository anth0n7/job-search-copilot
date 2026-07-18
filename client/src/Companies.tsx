import { useState } from 'react'
import type { Company } from './types';

interface CompaniesProps {
    companies : Company [];
    setCompanies: React.Dispatch<React.SetStateAction<Company[]>>;
}

function Companies({companies, setCompanies}: CompaniesProps){
    const [name, setName] = useState('');
    const [website, setWebsite] = useState('');
    const [notes, setNotes] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);

    //map means loop through every item in the array. The format has to look like this.
    function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
    e.preventDefault();
    if(editingId !== null){
      fetch(`http://localhost:3001/companies/${editingId}`,{
        method: 'PUT',
        headers: {'Content-Type' : 'application/json'},
        body: JSON.stringify({name, website, notes}),
      })
      .then((response) => {
        if (!response.ok) {
            throw new Error('Request failed');
        }
            return response.json();
        })
      .then((editedCompany) => {
        setCompanies(companies.map((currentCompany) => (
          currentCompany.id === editingId ? editedCompany : currentCompany
        )));
      })
      .catch((err) => {
        console.error('Failed to fetch company:', err);
      })
    }
    else{
      fetch('http://localhost:3001/companies', {
        method: 'POST',
        headers: {'Content-Type' : 'application/json'},
        body: JSON.stringify({name, website, notes}),
      })
      .then((response) => {
        if (!response.ok) {
            throw new Error('Request failed');
        }
            return response.json();
        })
      .then((company) =>{
        setCompanies([company, ...companies]);
      })
      .catch((err) => {
        console.error('Failed to fetch company:', err);
      })
  }

    setName('');
    setWebsite('');
    setNotes('');
    setEditingId(null);
  }

  function handleDelete(deletedID: number){
    fetch(`http://localhost:3001/companies/${deletedID}`, {
      method: 'DELETE',
    })
    .then((response) => {
        if (!response.ok) {
            throw new Error('Request failed');
        }
            return response.json();
        })
    .then(() => {
      setCompanies(companies.filter((keptCompany) => keptCompany.id !== deletedID));
      if(editingId === deletedID){
      setEditingId(null);
    }
    })
    .catch((err) => {
      console.error('Failed to fetch company:', err);
    })
  }

  //just brings company information to be edited
  //we use ?? '' because of the structure of our interface and useState('') which expects a string
  function handleEdit(editedCompany: Company){
    setName(editedCompany.name);
    setWebsite(editedCompany.website ?? '');
    setNotes(editedCompany.notes ?? '');
    setEditingId(editedCompany.id);
  }

  function handleCancel(){
    setName('');
    setNotes('');
    setWebsite('');
    setEditingId(null);
  }
    // arrow function for delete waits for an acutal click
    return(
        <div>
            <ul>
                {companies.map((company) =>(
                <li key={company.id}>{company.name}
                <button onClick={() => handleDelete(company.id)}>Delete</button>
                <button onClick={() => handleEdit(company)}>Edit</button>
                </li>
                ))}
            </ul>
            
            <form onSubmit={handleSubmit}>
                <label htmlFor="name">Name</label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)}/>

                <label htmlFor="website">Website</label>
                <input id="website" value={website} onChange={(e) => setWebsite(e.target.value)}/>

                <label htmlFor="notes">Notes</label>
                <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}/>

                <button type="submit">{editingId === null ? "Add Company" : "Save Changes"}</button>
                {editingId !== null && <button type="button" onClick={() => handleCancel()}>Cancel</button>}
            </form>
        </div>
    )
}

export default Companies;