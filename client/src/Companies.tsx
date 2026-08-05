import { useState } from 'react'
import type { Company } from './types';
import { useApi } from './useApi'
import { useError } from './useError'

interface CompaniesProps {
    companies : Company [];
    setCompanies: React.Dispatch<React.SetStateAction<Company[]>>;
    onCompanyDeleted: () => void;
}

function Companies({companies, setCompanies, onCompanyDeleted}: CompaniesProps){
    const [name, setName] = useState('');
    const [website, setWebsite] = useState('');
    const [notes, setNotes] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const apiFetch = useApi();
    const {setErrorMessage} = useError();

    //map means loop through every item in the array. The format has to look like this.
    function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
    e.preventDefault();
    if(editingId !== null){
        apiFetch(`/companies/${editingId}`, {
            method: 'PUT',
            headers: {'Content-Type' : 'application/json'},
            body: JSON.stringify({name, website, notes}),
        })
        .then((editedCompany) => {
            setCompanies(companies.map((currentCompany) => (
            currentCompany.id === editingId ? editedCompany : currentCompany
            )));
        })
        .catch((err) => {console.error('Failed to fetch company:', err);
            setErrorMessage(err.message);
        });
    }
    else{
        apiFetch('/companies', {
            method: 'POST',
            headers: {'Content-Type' : 'application/json'},
            body: JSON.stringify({name, website, notes}),
        })
        .then((company) =>{
            setCompanies([company, ...companies]);
        })
        .catch((err) => {console.error('Failed to fetch company:', err);
            setErrorMessage(err.message);
        });
    }

    setName('');
    setWebsite('');
    setNotes('');
    setEditingId(null);
  }

  function handleDelete(deletedID: number){
    const confirmed = window.confirm('Deleting this company will also delete all applications, contacts, and interview stages tied to it.');
    if(!confirmed){
        return;
    }
    apiFetch(`/companies/${deletedID}`, {
        method: 'DELETE'
    })
    .then(() => {
        setCompanies(companies.filter((keptCompany) => keptCompany.id !== deletedID));
        if(editingId === deletedID){
            setEditingId(null);
        }
            onCompanyDeleted();
        })
    .catch((err) => {console.error('Failed to fetch company:', err);
        setErrorMessage(err.message);
    });
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
        <div className="mb-5">
            <ul className="max-w-md mx-auto space-y-2">
                {companies.map((company) =>(
                <li key={company.id} className="flex items-center justify-between bg-gray-800 rounded-lg p-4">{company.name}
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-rose-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-rose-400" onClick={() => handleDelete(company.id)}>Delete</button>
                    <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400" onClick={() => handleEdit(company)}>Edit</button>
                </div>
                </li>
                ))}
            </ul>
            
            <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-gray-800 rounded-lg p-4 mt-4 space-y-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="name" value={name} required onChange={(e) => setName(e.target.value)}/>

                <label htmlFor="website" className="block text-sm font-medium text-gray-300 mb-1">Website</label>
                <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="website" value={website} onChange={(e) => setWebsite(e.target.value)}/>

                <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}/>

                <div className="flex justify-center gap-2">
                    <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400" type="submit">{editingId === null ? "Add Company" : "Save Changes"}</button>
                    {editingId !== null && <button className="px-4 py-2 bg-gray-700 text-sm font-medium text-gray-100 rounded-lg hover:bg-gray-600" type="button" onClick={() => handleCancel()}>Cancel</button>}
                </div>
            </form>
        </div>
    )
}

export default Companies;