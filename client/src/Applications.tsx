import { useState } from 'react'
import type { Company, Application} from './types';
import { useNavigate } from 'react-router'
import { useApi } from './useApi'
import { useError } from './useError'
import { Trash2, Pencil, Plus, Check, X, Briefcase} from 'lucide-react';
import StatusBadge from './StatusBadge';
import ConfirmDialog from './ConfirmDialog';

interface ApplicationsProps {
    companies: Company[];
    applications: Application [];
    setApplications:  React.Dispatch<React.SetStateAction<Application[]>>;
    isLoading: boolean;
}

function Applications({companies, applications, setApplications, isLoading}: ApplicationsProps){
    const [role_title, setRoleTitle] = useState('');
    const [job_posting_url, setJobUrl] = useState('');
    const [status, setStatus] = useState('');
    const [application_date, setApplicationDate] = useState('');
    const [company_id, setCompanyId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const navigate = useNavigate();
    const apiFetch = useApi();
    const {setErrorMessage} = useError();

    function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
        e.preventDefault();
        const dateToSend = application_date === '' ? null : application_date;
        if(editingId !== null){
            apiFetch(`/applications/${editingId}`, {
                method: 'PUT',
                headers: {'Content-Type' : 'application/json'},
                body: JSON.stringify({role_title, job_posting_url, status, application_date: dateToSend, company_id}),
            })
            .then((editedApplication) => {
                setApplications(applications.map((currentApplication) =>(
                    currentApplication.id === editingId ? editedApplication : currentApplication
                )));
            })
            .catch((err) =>{console.error('Failed to fetch application', err)
                setErrorMessage(err.message);
            });
        }
        else{
            apiFetch('/applications', {
                method: 'POST',
                headers: {'Content-Type' : 'application/json'},
                body:  JSON.stringify({role_title, job_posting_url, status, application_date: dateToSend, company_id}),
            })
            .then((newApplication) =>{
                setApplications([newApplication, ...applications]);
            })
            .catch((err) =>{console.error('Failed to fetch application', err)
                setErrorMessage(err.message);
            });
        }

        setRoleTitle('');
        setJobUrl('');
        setStatus('');
        setApplicationDate('');
        setCompanyId(null);
        setEditingId(null);
    }


    function handleDelete(deletedId: number){
        apiFetch(`/applications/${deletedId}`,{
            method: 'DELETE'
        })
        .then(() =>{
            setApplications(applications.filter((keptApplication) => keptApplication.id !== deletedId));
            if(editingId === deletedId){
                setEditingId(null);
            }
        })
        .catch((err) =>{console.error('Failed to fetch application', err)
            setErrorMessage(err.message);
        })
        .finally(() => setPendingDeleteId(null));

    }

    function handleEdit(editedApplication: Application){
        setRoleTitle(editedApplication.role_title);
        setJobUrl(editedApplication.job_posting_url ?? '');
        setStatus(editedApplication.status);
        setApplicationDate(editedApplication.application_date ?? '');
        setCompanyId(editedApplication.company_id);
        setEditingId(editedApplication.id);
    }

    function handleCancel(){
        setRoleTitle('');
        setJobUrl('');
        setStatus('');
        setApplicationDate('');
        setCompanyId(null);
        setEditingId(null);
    }

    return(
        <div className="mb-5">
            <h1 className="page-title mb-5">Applications</h1>

            {isLoading && (
                <div className="max-w-md mx-auto space-y-2">
                    <div className="skeleton h-14" />
                    <div className="skeleton h-14" />
                    <div className="skeleton h-14" />
                </div>
            )}

            {!isLoading && applications.length === 0 && (
                <div className="max-w-md mx-auto card p-8 text-center">
                    <Briefcase size={28} className="mx-auto text-slate-500 mb-3" />
                    <p className="text-slate-300 font-medium">No applications yet</p>
                    <p className="muted text-sm mt-1">Add your first application below to start tracking it.</p>
                </div>
            )}

            {!isLoading && applications.length > 0 && (
                <ul className="max-w-md mx-auto space-y-2">
                    {applications.map((application) => (
                    <li key={application.id} onClick={() => navigate(`/applications/${application.id}`)} className="card card-hover flex items-center justify-between p-4 cursor-pointer">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{application.role_title}</span>
                            <StatusBadge status={application.status} />
                        </div>
                    <div className="flex gap-2">
                        <button className="btn-danger" onClick={(e) => {e.stopPropagation(); setPendingDeleteId(application.id);}}>
                            <Trash2 size={16} />
                            Delete
                        </button>
                        <button className="btn-primary" onClick={(e) => {e.stopPropagation(); handleEdit(application);}}>
                            <Pencil size={16} />
                            Edit
                        </button>
                    </div>
                    </li>
                    ))}
                </ul>
            )}

            <form onSubmit={handleSubmit} className="max-w-md mx-auto card p-4 mt-4 space-y-4">
                <label htmlFor="roleTitle" className="form-label">Role Title</label>
                <input className="input-field" id="roleTitle" value={role_title} onChange={(e) => setRoleTitle(e.target.value)}/>

                <label htmlFor="job_posting_url" className="form-label">Job URL</label>
                <input className="input-field" id="job_posting_url" value={job_posting_url} onChange={(e) => setJobUrl(e.target.value)}/>

                <label htmlFor="status" className="form-label">Status</label>
                <select className="input-field capitalize" id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option className="capitalize">saved</option>
                    <option className="capitalize">applied</option>
                    <option className="capitalize">interviewing</option>
                    <option className="capitalize">rejected</option>
                    <option className="capitalize">offer</option>
                </select>

                <label htmlFor="applicationDate" className="form-label">Application Date</label>
                <input className="input-field" id="applicationDate" value={application_date} type="date" onChange={(e) => setApplicationDate(e.target.value)}/>

                 <label htmlFor="company_id" className="form-label">Company</label>
                <select id="company_id" className="input-field" value={company_id ?? ''} onChange={(e) => setCompanyId(Number(e.target.value))} required>
                    <option value="" disabled>Select a company...</option>
                    {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                </select>
                <div className="flex justify-center gap-2">
                    <button className="btn-primary" type="submit">
                        {editingId === null ? <Plus size={16} /> : <Check size={16} />}
                        {editingId === null ? "Add Application" : "Save Changes"}
                    </button>
                        {editingId !== null && <button type="button" className="btn-secondary" onClick={() => handleCancel()}>
                        <X size={16} />
                        Cancel
                    </button>}
                </div>
            </form>

            <ConfirmDialog
                open={pendingDeleteId !== null}
                title="Delete application?"
                message="Deleting this application will also delete all interview stage information tied to it."
                onConfirm={() => pendingDeleteId !== null && handleDelete(pendingDeleteId)}
                onCancel={() => setPendingDeleteId(null)}
            />

        </div>
    )
}

export default Applications