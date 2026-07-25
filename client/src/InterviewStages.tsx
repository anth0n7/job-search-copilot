import { useState, useEffect } from 'react'
import type { InterviewStage, Company, Application } from './types';

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

    useEffect(() => {
      fetch('http://localhost:3001/interview_stages')
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
    } , []);

    function handleDelete(deletedId: number){
        fetch(`http://localhost:3001/interview_stages/${deletedId}`, {
            method: 'DELETE',
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
            fetch(`http://localhost:3001/interview_stages/${editingId}`,{
                method: 'PUT',
                headers: {'Content-Type' : 'application/json'},
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
        }
        else{
            fetch('http://localhost:3001/interview_stages', {
                method: 'POST',
                headers: {'Content-Type' : 'application/json'},
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
        <div>

            <ul>
               {interview_stages.map((interview_stage) => (
               <li key={interview_stage.id}>{interview_stage.stage_name}
               <button onClick={() => handleDelete(interview_stage.id)}>Delete</button>
                <button onClick={() => handleEdit(interview_stage)}>Edit</button>              
               </li> 
               ))} 
            </ul>
            
            <form onSubmit={handleSubmit}>
                <label htmlFor="stage_name">Stage Name</label>
                <input id="stage_name" value={stage_name} onChange={(e) => setStageName(e.target.value)}/>

                <label htmlFor="scheduled_date">Scheduled Date</label>
                <input id="scheduled_date" value={scheduled_date} type="datetime-local" onChange={(e) => setScheduledDate(e.target.value)}/>

                <label htmlFor="completed">Completed</label>
                <input id="completed" checked={completed} type="checkbox" onChange={(e) => setCompleted(e.target.checked)}/>

                <label htmlFor="notes">Notes</label>
                <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}/>

                <select value={application_id ?? ''} onChange={(e) => setApplicationId(Number(e.target.value))} required>
                <option value="" disabled>Select an application...</option>

                {applications.map((application) => {
                    const matchedCompany = companies.find((company) => company.id === application.company_id);
                    return (
                    <option key={application.id} value={application.id}>{application.role_title} at {matchedCompany?.name}</option>
                    );
                })}
                </select>

                <button type="submit">{editingId === null ? "Add Interview Stage" : "Save Changes"}</button> 
                {editingId !== null && <button type="button" onClick={() => handleCancel()}>Cancel</button>}
            </form>

        </div>
    )
}

export default InterviewStages