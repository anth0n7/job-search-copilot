import { useState } from 'react'
import type { Company, Application } from './types';
import { useApi } from './useApi'
import { useError } from './useError'
import CompanyContacts from './CompanyContacts';
import { Trash2, Plus, Check, X} from 'lucide-react';

interface CompaniesProps {
    companies : Company [];
    applications: Application[]
    setCompanies: React.Dispatch<React.SetStateAction<Company[]>>;
    onCompanyDeleted: () => void;
}

function Companies({companies, applications, setCompanies, onCompanyDeleted}: CompaniesProps){
    const [name, setName] = useState('');
    const [website, setWebsite] = useState('');
    const [notes, setNotes] = useState('');
    const [modalName, setModalName] = useState('');
    const [modalWebsite, setModalWebsite] = useState('');
    const [modalNotes, setModalNotes] = useState('');
    const apiFetch = useApi();
    const {setErrorMessage} = useError();
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const filteredApplications =  applications.filter((application) => application.company_id === selectedCompany?.id);

    //map means loop through every item in the array. The format has to look like this.
    function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
        e.preventDefault();
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
    
        setName('');
        setWebsite('');
        setNotes('');
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
            onCompanyDeleted();
        })
    .catch((err) => {console.error('Failed to fetch company:', err);
        setErrorMessage(err.message);
    });
  }


  function handleViewCompany(company: Company){
    setSelectedCompany(company);
    setModalName(company.name);
    setModalWebsite(company.website ?? '');
    setModalNotes(company.notes ?? '');
  }

  function handleSaveModal(){
    apiFetch(`/companies/${selectedCompany?.id}`, {
        method: 'PUT',
        headers: {'Content-Type' : 'application/json'},
        body: JSON.stringify({name: modalName, website: modalWebsite, notes: modalNotes}),
    })
    .then((selectCompany) => {
            setCompanies(companies.map((company) => (
            company.id === selectCompany.id ? selectCompany : company
        )));
        setSelectedCompany(null)
    })
    .catch((err) => {console.error('Failed to fetch company:', err);
            setErrorMessage(err.message);
    });
  }
    // arrow function for delete waits for an acutal click
    return(
        <div className="mb-5">
            <div>
                <h1 className="flex justify-center font-semibold mb-5">Companies</h1>
                <ul className="max-w-md mx-auto space-y-2">
                    {companies.map((company) =>(
                    <li key={company.id} className="flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-lg p-4 transition-colors cursor-pointer" onClick={() => handleViewCompany(company)}>{company.name}
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button className="flex items-center gap-1 px-4 py-2 bg-rose-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-rose-400" onClick={() => handleDelete(company.id)}>
                            <Trash2 size={16} />
                            Delete
                        </button>
                    </div>
                    </li>
                    ))}
                </ul>
            </div>

            {selectedCompany && (
                 <div className="fixed inset-0 bg-black/50 flex items-center justify-center" onClick={() => setSelectedCompany(null)}>
                    <div onClick={(e) => e.stopPropagation()} className="bg-gray-800 rounded-lg p-4 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <h1 className="flex justify-center font-medium mb-2">Company Info</h1>
                        <div className="p-2">
                            <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="modal_name">Name:</label>
                            <input id="modal_name" className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" required value={modalName} onChange={(e) => setModalName(e.target.value)}/>    
                        </div>

                        <div className="p-2">
                            <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="modal_website">Website:</label>
                            <input id="modal_website" className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" value={modalWebsite} onChange={(e) => setModalWebsite(e.target.value)}/>    
                        </div>

                        <div className="p-2">
                            <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="modal_notes">Notes:</label>
                            <input id="modal_notes" className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" value={modalNotes} onChange={(e) => setModalNotes(e.target.value)}/>    
                        </div>

                         <div>
                            <h2 className="flex justify-center mt-6 border-t pt-4  font-medium">Applications at {selectedCompany.name}</h2>
                            {filteredApplications.map((application) =>(
                                <p key={application.id} className="text-center">{application.role_title}</p>
                            ))}
                            {filteredApplications.length === 0 && <p className="text-center text-gray-400">No applications yet</p>}
                        </div>

                         <CompanyContacts companyID={selectedCompany.id} />

                         <div className="flex justify-center gap-2 mt-4">
                            <button className="flex items-center gap-1 px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400 cursor-pointer" type="button" onClick={() => handleSaveModal()}>
                                <Check size={16} />
                                Save
                            </button> 
                            <button className="flex items-center gap-1 px-4 py-2 bg-gray-700 text-sm font-medium text-gray-100 rounded-lg hover:bg-gray-600 cursor-pointer" type="button" onClick={() => setSelectedCompany(null)}>
                                <X size={16} />
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <div>
                <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-gray-800 rounded-lg mt-4 p-4 space-y-4">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                    <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="name" value={name} required onChange={(e) => setName(e.target.value)}/>

                    <label htmlFor="website" className="block text-sm font-medium text-gray-300 mb-1">Website</label>
                    <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="website" value={website} onChange={(e) => setWebsite(e.target.value)}/>

                    <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">Notes</label>
                    <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}/>

                    <div className="flex justify-center gap-2">
                        <button className="flex items-center gap-1 px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400" type="submit">
                            <Plus size={16} />
                            Add Company
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default Companies;