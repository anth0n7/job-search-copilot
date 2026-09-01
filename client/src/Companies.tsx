import { useState } from 'react'
import type { Company, Application } from './types';
import { useApi } from './useApi'
import { useError } from './useError'
import CompanyContacts from './CompanyContacts';
import { Trash2, Plus, Check, X, Building2} from 'lucide-react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';

interface CompaniesProps {
    companies : Company [];
    applications: Application[]
    setCompanies: React.Dispatch<React.SetStateAction<Company[]>>;
    onCompanyDeleted: () => void;
    isLoading: boolean;
}

function Companies({companies, applications, setCompanies, onCompanyDeleted, isLoading}: CompaniesProps){
    const [name, setName] = useState('');
    const [website, setWebsite] = useState('');
    const [notes, setNotes] = useState('');
    const [modalName, setModalName] = useState('');
    const [modalWebsite, setModalWebsite] = useState('');
    const [modalNotes, setModalNotes] = useState('');
    const apiFetch = useApi();
    const {setErrorMessage} = useError();
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
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
    apiFetch(`/companies/${deletedID}`, {
        method: 'DELETE'
    })
    .then(() => {
        setCompanies(companies.filter((keptCompany) => keptCompany.id !== deletedID));
            onCompanyDeleted();
        })
    .catch((err) => {console.error('Failed to fetch company:', err);
        setErrorMessage(err.message);
    })
    .finally(() => setPendingDeleteId(null));
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
                <h1 className="page-title mb-5">Companies</h1>

                {isLoading && (
                    <div className="max-w-md mx-auto space-y-2">
                        <div className="skeleton h-14" />
                        <div className="skeleton h-14" />
                        <div className="skeleton h-14" />
                    </div>
                )}

                {!isLoading && companies.length === 0 && (
                    <div className="max-w-md mx-auto card p-8 text-center">
                        <Building2 size={28} className="mx-auto text-slate-500 mb-3" />
                        <p className="text-slate-300 font-medium">No companies yet</p>
                        <p className="muted text-sm mt-1">Add a company below to start tracking applications there.</p>
                    </div>
                )}

                {!isLoading && companies.length > 0 && (
                    <ul className="max-w-md mx-auto space-y-2">
                        {companies.map((company) =>(
                        <li key={company.id} className="card card-hover flex items-center justify-between p-4 cursor-pointer" onClick={() => handleViewCompany(company)}>
                        <span className="font-medium">{company.name}</span>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button className="btn-danger" onClick={() => setPendingDeleteId(company.id)}>
                                <Trash2 size={16} />
                                Delete
                            </button>
                        </div>
                        </li>
                        ))}
                    </ul>
                )}
            </div>

            {selectedCompany && (
                <Modal title="Company Info" onClose={() => setSelectedCompany(null)} maxWidth="max-w-2xl">
                    <div className="space-y-4">
                        <div>
                            <label className="form-label" htmlFor="modal_name">Name:</label>
                            <input id="modal_name" className="input-field" required value={modalName} onChange={(e) => setModalName(e.target.value)}/>
                        </div>

                        <div>
                            <label className="form-label" htmlFor="modal_website">Website:</label>
                            <input id="modal_website" className="input-field" value={modalWebsite} onChange={(e) => setModalWebsite(e.target.value)}/>
                        </div>

                        <div>
                            <label className="form-label" htmlFor="modal_notes">Notes:</label>
                            <input id="modal_notes" className="input-field" value={modalNotes} onChange={(e) => setModalNotes(e.target.value)}/>
                        </div>

                        <div className="divider pt-4">
                            <h2 className="section-title mb-2">Applications at {selectedCompany.name}</h2>
                            {filteredApplications.map((application) =>(
                                <p key={application.id} className="text-sm">{application.role_title}</p>
                            ))}
                            {filteredApplications.length === 0 && <p className="text-sm muted">No applications yet</p>}
                        </div>

                        <CompanyContacts companyID={selectedCompany.id} />

                        <div className="flex justify-end gap-2 pt-2">
                            <button className="btn-secondary" type="button" onClick={() => setSelectedCompany(null)}>
                                <X size={16} />
                                Cancel
                            </button>
                            <button className="btn-primary" type="button" onClick={() => handleSaveModal()}>
                                <Check size={16} />
                                Save
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            <div>
                <form onSubmit={handleSubmit} className="max-w-md mx-auto card mt-4 p-4 space-y-4">
                    <label htmlFor="name" className="form-label">Name</label>
                    <input className="input-field" id="name" value={name} required onChange={(e) => setName(e.target.value)}/>

                    <label htmlFor="website" className="form-label">Website</label>
                    <input className="input-field" id="website" value={website} onChange={(e) => setWebsite(e.target.value)}/>

                    <label htmlFor="notes" className="form-label">Notes</label>
                    <input className="input-field" id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}/>

                    <div className="flex justify-center gap-2">
                        <button className="btn-primary" type="submit">
                            <Plus size={16} />
                            Add Company
                        </button>
                    </div>
                </form>
            </div>

            <ConfirmDialog
                open={pendingDeleteId !== null}
                title="Delete company?"
                message="Deleting this company will also delete all applications, contacts, and interview stages tied to it."
                onConfirm={() => pendingDeleteId !== null && handleDelete(pendingDeleteId)}
                onCancel={() => setPendingDeleteId(null)}
            />
        </div>
    )
}

export default Companies;
