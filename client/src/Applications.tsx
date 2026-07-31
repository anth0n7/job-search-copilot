import { useState } from 'react'
import type { Company, Application} from './types';
import { useNavigate } from 'react-router'
import { useApi } from './useApi'

interface ApplicationsProps {
    companies: Company[];
    applications: Application [];
    setApplications:  React.Dispatch<React.SetStateAction<Application[]>>;
}

function Applications({companies, applications, setApplications}: ApplicationsProps){
    const [role_title, setRoleTitle] = useState('');
    const [job_posting_url, setJobUrl] = useState('');
    const [status, setStatus] = useState('');
    const [application_date, setApplicationDate] = useState('');
    const [company_id, setCompanyId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const navigate = useNavigate();
    const apiFetch = useApi();

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
            .catch((err) =>{console.error('Failed to fetch application', err)});
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
            .catch((err) =>{console.error('Failed to fetch application', err)});
        }

        setRoleTitle('');
        setJobUrl('');
        setStatus('');
        setApplicationDate('');
        setCompanyId(null);
        setEditingId(null);
    }


    function handleDelete(deletedId: number){
        const confirmed = window.confirm('Deleting this application will also delete all interview stage information tied to it.');
        if(!confirmed){
            return;
        }
        apiFetch(`/applications/${deletedId}`,{
            method: 'DELETE'
        })
        .then(() =>{
            setApplications(applications.filter((keptApplication) => keptApplication.id !== deletedId));
            if(editingId === deletedId){
                setEditingId(null);
            }
        })
        .catch((err) =>{console.error('Failed to fetch application', err)})

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
            <ul className="max-w-md mx-auto space-y-2">
                {applications.map((application) => (
                <li key={application.id} onClick={() => navigate(`/applications/${application.id}`)} className="flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-lg p-4 transition-colors cursor-pointer">{application.role_title}
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-rose-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-rose-400 cursor-pointer" onClick={(e) => {e.stopPropagation(); handleDelete(application.id);}}>Delete</button>
                    <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400 cursor-pointer" onClick={(e) => {e.stopPropagation(); handleEdit(application);}}>Edit</button>
                </div>
                </li> 
                ))}
            </ul>
            
            <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-gray-800 rounded-lg p-4 mt-4 space-y-4">
                <label htmlFor="roleTitle" className="block text-sm font-medium text-gray-300 mb-1">Role Title</label>
                <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="roleTitle" value={role_title} onChange={(e) => setRoleTitle(e.target.value)}/>

                <label htmlFor="job_posting_url" className="block text-sm font-medium text-gray-300 mb-1">Job URL</label>
                <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="job_posting_url" value={job_posting_url} onChange={(e) => setJobUrl(e.target.value)}/>

                <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                <select className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option >saved</option>
                    <option>applied</option>
                    <option>interviewing</option>
                    <option>rejected</option>
                    <option>offer</option>
                </select>

                <label htmlFor="applicationDate" className="block text-sm font-medium text-gray-300 mb-1">Application Date</label>
                <input className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" id="applicationDate" value={application_date} type="date" onChange={(e) => setApplicationDate(e.target.value)}/>

                 <label htmlFor="company_id" className="block text-sm font-medium text-gray-300 mb-1">Company</label>
                <select id="company_id" className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" value={company_id ?? ''} onChange={(e) => setCompanyId(Number(e.target.value))} required>
                    <option value="" disabled>Select a company...</option>
                    {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                </select>
                <div className="flex justify-center gap-2">
                    <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400" type="submit">{editingId === null ? "Add Application" : "Save Changes"}</button>
                    {editingId !== null && <button type="button" className="px-4 py-2 bg-gray-700 text-sm font-medium text-gray-100 rounded-lg hover:bg-gray-600" onClick={() => handleCancel()}>Cancel</button>}
                </div>
            </form>

        </div>
    )
}

export default Applications