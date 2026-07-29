import { useState, useEffect } from 'react'
import type { InterviewStage, Company, Application } from './types';
import { useAuth } from '@clerk/react';

interface InterviewStagesProps{
    companies: Company [];
    applications: Application [];
}

function InterviewStages({companies, applications} : InterviewStagesProps){
    const [interview_stages, setInterviewStages] = useState<InterviewStage[]>([]);
    const [application_id, setApplicationId] = useState<number | null>(null);
    const [stage_name, setStageName] = useState('');
    const [scheduled_date, setScheduledDate] = useState('');
    const [completed, setCompleted] = useState<boolean>(false);
    const [notes, setNotes] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const { getToken } = useAuth();

    useEffect(() => {
      getToken().then((token) => {  
        fetch('http://localhost:3001/interview_stages', {
            headers: {Authorization: `Bearer ${token}`},
        })
        .then((response) => {
            if(!response.ok){
                throw new Error('Response failed');
            }
            return response.json()
        })
        .then((data) => {
            setInterviewStages(data);
        })
        .catch((err) =>{
            console.error("Failed to fetch interview stages:", err);
        })
    });
    } , []);

    function handleDelete(deletedId: number){
        getToken().then((token) => { 
            fetch(`http://localhost:3001/interview_stages/${deletedId}`, {
                method: 'DELETE',
                headers: {Authorization: `Bearer ${token}`},
            })
            .then((response) => {
                if(!response.ok){
                    throw new Error('Response failed');
                }
                return response.json()
            })
            .then(() => {
                setInterviewStages(interview_stages.filter((current_interview_stage) => current_interview_stage.id !== deletedId));
                if(editingId === deletedId){
                    setEditingId(null);
                }
            })
            .catch((err) => {
                console.error('Failed to fetch interview stages:', err);
            }) 
        });
    }

    function handleEdit(editedInterviewStage: InterviewStage){
        setApplicationId(editedInterviewStage.application_id);
        setCompleted(editedInterviewStage.completed ?? false);
        setEditingId(editedInterviewStage.id);
        setNotes(editedInterviewStage.notes ?? '');
        setScheduledDate(editedInterviewStage.scheduled_date ?? '');
        setStageName(editedInterviewStage.stage_name);   
    }

    function handleSubmit(e: React.SubmitEvent<HTMLFormElement>){
        e.preventDefault();
        const dateToSend = scheduled_date === '' ? null : scheduled_date;
        if(editingId !== null){
            getToken().then((token) => { 
                fetch(`http://localhost:3001/interview_stages/${editingId}`,{
                    method: 'PUT',
                    headers: {
                        'Content-Type' : 'application/json',
                         Authorization: `Bearer ${token}`,   
                    },
                    body: JSON.stringify({application_id, completed, notes, scheduled_date: dateToSend, stage_name})
                })
                .then((response) =>{
                    if(!response.ok){
                        throw new Error('Response failed');
                    }
                    return response.json();
                })
                .then((editedInterviewStage) =>{
                setInterviewStages(interview_stages.map((current_interview_stage) =>(
                    current_interview_stage.id === editingId ? editedInterviewStage : current_interview_stage
                ))); 
                })
                .catch((err) =>{
                    console.error('Failed to fetch interview stages:', err);
                })
            });
        }
        else{
            getToken().then((token) => {
                fetch('http://localhost:3001/interview_stages', {
                    method: 'POST',
                    headers: {
                        'Content-Type' : 'application/json',
                         Authorization: `Bearer ${token}`,   
                    },
                    body: JSON.stringify({application_id, completed, notes, scheduled_date: dateToSend, stage_name})
                })
                .then((response) =>{
                    if(!response.ok){
                        throw new Error('Response failed');
                    }
                    return response.json();
                })    
                .then((interview_stage) =>{
                    setInterviewStages([interview_stage, ...interview_stages]);
                })
                .catch((err) =>{
                    console.error('Failed to fetch interview stages:', err);
                })
            });
        }
        setApplicationId(null);
        setCompleted(false);
        setEditingId(null);
        setNotes('');
        setScheduledDate('');
        setStageName('');

    }

    function handleCancel(){
        setApplicationId(null);
        setCompleted(false);
        setEditingId(null);
        setNotes('');
        setScheduledDate('');
        setStageName('');
    }



    return (
        <div className="mb-5">

            <ul className="max-w-md mx-auto space-y-2">
               {interview_stages.map((interview_stage) => (
               <li className="flex items-center justify-between bg-gray-800 rounded-lg p-4" key={interview_stage.id}>{interview_stage.stage_name}
               <div className="flex gap-2">
                    <button className="px-4 py-2 bg-rose-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-rose-400" onClick={() => handleDelete(interview_stage.id)}>Delete</button>
                    <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400" onClick={() => handleEdit(interview_stage)}>Edit</button>              
               </div>
               </li> 
               ))} 
            </ul>
            
            <form onSubmit={handleSubmit} className="max-w-md mx-auto bg-gray-800 rounded-lg p-4 mt-4 space-y-4">
                <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="stage_name">Stage Name</label>
                <input id="stage_name" className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" value={stage_name} onChange={(e) => setStageName(e.target.value)}/>

                <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="scheduled_date">Scheduled Date</label>
                <input id="scheduled_date" className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" value={scheduled_date} type="datetime-local" onChange={(e) => setScheduledDate(e.target.value)}/>

                <div className="flex items-center gap-2">
                    <input id="completed" checked={completed} type="checkbox" className="h-5 w-5 rounded border-gray-700 bg-gray-900 text-sky-500 focus:ring-2 focus:ring-sky-500" onChange={(e) => setCompleted(e.target.checked)}/>
                    <label htmlFor="completed" className="text-sm font-medium text-gray-300">Completed</label>
                </div>

                <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="notes">Notes</label>
                <input id="notes" className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" value={notes} onChange={(e) => setNotes(e.target.value)}/>

                <label htmlFor="application_id" className="block text-sm font-medium text-gray-300 mb-1">Application</label>
                <select id="application_id" className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500" value={application_id ?? ''} onChange={(e) => setApplicationId(Number(e.target.value))} required>
                <option value="" disabled>Select an application...</option>

                {applications.map((application) => {
                    const matchedCompany = companies.find((company) => company.id === application.company_id);
                    return (
                    <option key={application.id} value={application.id}>{application.role_title} at {matchedCompany?.name}</option>
                    );
                })}
                </select>
                <div className="flex justify-center gap-2">
                    <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400" type="submit">{editingId === null ? "Add Interview Stage" : "Save Changes"}</button> 
                    {editingId !== null && <button className="px-4 py-2 bg-gray-700 text-sm font-medium text-gray-100 rounded-lg hover:bg-gray-600" type="button" onClick={() => handleCancel()}>Cancel</button>}
                </div>
            </form>

        </div>
    )
}

export default InterviewStages