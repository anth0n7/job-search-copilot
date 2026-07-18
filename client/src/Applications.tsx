import { useState, useEffect } from 'react'
import type { Company, Application} from './types';
 

interface ApplicationsProps {
    companies: Company[]
}

function Applications({companies}: ApplicationsProps){
    const [applications, setApplications] = useState<Application[]>([]);
    const [role_title, setRoleTitle] = useState('');
    const [job_posting_url, setJobUrl] = useState('');
    const [status, setStatus] = useState('');
    const [application_date, setApplicationDate] = useState('');
    const [company_id, setCompanyId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);

    useEffect(() =>{
        fetch('http://localhost:3001/applications')
        .then((response) => {
            if (!response.ok) {
                throw new Error('Request failed');
            }
            return response.json();
        })
        .then((data) =>{
            setApplications(data);
        })
        .catch((err) =>{
            console.error('Failed to fetch applications', err);
        })
    }, []);

    function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
        e.preventDefault();
        const dateToSend = application_date === '' ? null : application_date;
        if(editingId !== null){
            fetch(`http://localhost:3001/applications/${editingId}`, {
                method: 'PUT',
                headers: {'Content-Type' : 'application/json'},
                body: JSON.stringify({role_title, job_posting_url, status, application_date: dateToSend, company_id}),
            })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
            return response.json();
        })
            .then((editedApplication) => {
                setApplications(applications.map((currentApplication) =>(
                    currentApplication.id === editingId ? editedApplication : currentApplication
                )));
            })
            .catch((err) =>{
                console.error('Failed to fetch application', err);
            })
        }
        else{
            fetch('http://localhost:3001/applications', {
                method: 'POST',
                headers: {'Content-Type' : 'application/json'},
                body: JSON.stringify({role_title, job_posting_url, status, application_date: dateToSend, company_id}),
            })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Request failed');
                }
            return response.json();
        })
            .then((newApplication) =>{
                setApplications([newApplication, ...applications]);
            })
            .catch((err) =>{
                console.error('Failed to fetch application', err);
            })
        }

        setRoleTitle('');
        setJobUrl('');
        setStatus('');
        setApplicationDate('');
        setCompanyId(null);
        setEditingId(null);
    }


    function handleDelete(deletedId: number){
        fetch(`http://localhost:3001/applications/${deletedId}`,{
            method: 'DELETE',             
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Request failed');
            }
            return response.json();
        })
        .then(() =>{
            setApplications(applications.filter((keptApplication) => keptApplication.id !== deletedId));
            if(editingId === deletedId){
                setEditingId(null);
            }
        })
        .catch((err) =>{
            console.error('Failed to fetch application', err);
        })

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
        <div>
            <ul>
                {applications.map((application) => (
                <li key={application.id}>{application.role_title}
                <button onClick={() => handleDelete(application.id)}>Delete</button>
                <button onClick={() => handleEdit(application)}>Edit</button>
                </li> 
                ))}
            </ul>
            
            <form onSubmit={handleSubmit}>
                <label htmlFor="roleTitle">Role Title</label>
                <input id="roleTitle" value={role_title} onChange={(e) => setRoleTitle(e.target.value)}/>

                <label htmlFor="job_posting_url">Job URL</label>
                <input id="job_posting_url" value={job_posting_url} onChange={(e) => setJobUrl(e.target.value)}/>

                <label htmlFor="status">Status</label>
                <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option >saved</option>
                    <option>applied</option>
                    <option>interviewing</option>
                    <option>rejected</option>
                    <option>offer</option>
                </select>

                <label htmlFor="applicationDate">Application Date</label>
                <input id="applicationDate" value={application_date} type="date" onChange={(e) => setApplicationDate(e.target.value)}/>

                <select value={company_id ?? ''} onChange={(e) => setCompanyId(Number(e.target.value))} required>
                    <option value="" disabled>Select a company...</option>
                    {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                </select>
                <button type="submit">{editingId === null ? "Add Application" : "Save Changes"}</button>
                {editingId !== null && <button type="button" onClick={() => handleCancel()}>Cancel</button>}
            </form>

        </div>
    )
}

export default Applications