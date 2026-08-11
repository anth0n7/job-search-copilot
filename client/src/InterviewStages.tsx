import { useState, useEffect } from 'react'
import type { InterviewStage } from './types';
import { useApi } from './useApi'
import { useError } from './useError'


interface InterviewStagesProps{
   applicationID: number;
}

function InterviewStages({applicationID} : InterviewStagesProps){
    const [interview_stages, setInterviewStages] = useState<InterviewStage[]>([]);
    const [stage_name, setStageName] = useState('');
    const [scheduled_date, setScheduledDate] = useState('');
    const [completed, setCompleted] = useState<boolean>(false);
    const [notes, setNotes] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const apiFetch = useApi();
    const {setErrorMessage} = useError();


    //[applicationID] is a dependancy array. If applicationId changes run the effect again
    useEffect(() => {
        apiFetch(`/applications/${applicationID}/interview_stages`)
        .then((data) => {setInterviewStages(data);})
        .catch((err) =>{console.error("Failed to fetch interview stages:", err);
            setErrorMessage(err.message);
        })
    } , [applicationID]);

    function handleDelete(deletedId: number){
        apiFetch(`/interview_stages/${deletedId}`,{
            method: 'DELETE'
        })
        .then(() => {
            setInterviewStages(interview_stages.filter((current_interview_stage) => current_interview_stage.id !== deletedId));
            if(editingId === deletedId){
                setEditingId(null);
            }
        })
        .catch((err) => {
            console.error('Failed to fetch interview stages:', err);
            setErrorMessage(err.message);
        }) 
    }

    function handleEdit(editedInterviewStage: InterviewStage){
        setIsModalOpen(true);
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
            apiFetch(`/interview_stages/${editingId}`, {
               method: 'PUT',
               headers: {'Content-Type' : 'application/json'},
               body: JSON.stringify({application_id: applicationID, completed, notes, scheduled_date: dateToSend, stage_name})
            })
            .then((editedInterviewStage) =>{
                setInterviewStages(interview_stages.map((current_interview_stage) =>(
                    current_interview_stage.id === editingId ? editedInterviewStage : current_interview_stage
                ))); 
            })
            .catch((err) =>{console.error('Failed to fetch interview stages:', err);
                setErrorMessage(err.message);
            })
        }
        else{
            apiFetch('/interview_stages',{
                method: 'POST',
               headers: {'Content-Type' : 'application/json'},
               body: JSON.stringify({application_id: applicationID, completed, notes, scheduled_date: dateToSend, stage_name})    
            })   
            .then((interview_stage) =>{
                setInterviewStages([interview_stage, ...interview_stages]);
            })
            .catch((err) =>{console.error('Failed to fetch interview stages:', err);
                setErrorMessage(err.message);
            })
        }
        setCompleted(false);
        setIsModalOpen(false);
        setEditingId(null);
        setNotes('');
        setScheduledDate('');
        setStageName('');

    }

    function handleCancel(){
        setIsModalOpen(false);
        setCompleted(false);
        setEditingId(null);
        setNotes('');
        setScheduledDate('');
        setStageName('');
    }



    return (
        
        <div>
            <h1 className="flex justify-center font-semibold">Interview Stages:</h1>
            <div className="max-w-md mx-auto space-y-3">
               {interview_stages.map((interview_stage) => (
                <div key={interview_stage.id} className=" bg-gray-800 rounded-lg p-4">
                    <div className="flex gap-1">
                        <span className="font-medium">Name:</span>
                        <p> {interview_stage.stage_name}</p> 
                    </div>

                    <div className="flex gap-1">
                        <span className="font-medium">Scheduled Date:</span>
                        <p>{new Date(interview_stage.scheduled_date).toLocaleString()}</p>
                    </div>        

                    <div className="flex gap-1">
                        <span className="font-medium">Completed:</span>
                        <p>{interview_stage.completed ? "Yes" : "No"}</p>
                    </div>            

                    <div className="flex gap-1">
                        <span className="font-medium">Notes:</span>
                        <p>{interview_stage.notes}</p>
                    </div>

                    <div className=" mt-2 flex gap-2">
                        <button className="px-4 py-2 bg-rose-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-rose-400 cursor-pointer" onClick={() => handleDelete(interview_stage.id)}>Delete</button>
                        <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400 cursor-pointer" onClick={() => handleEdit(interview_stage)}>Edit Interview Stage</button>
                    </div>
                </div>
               ))} 
            </div>

            <div className="flex justify-center mt-3">
                <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400 cursor-pointer" onClick={() => setIsModalOpen(true)}>Add Interview Stage</button>
            </div>
            
           {isModalOpen && (
             <div className="fixed inset-0 bg-black/50 flex items-center justify-center" onClick={() => setIsModalOpen(false)}>
                <div onClick={(e) => e.stopPropagation()} className="bg-gray-800 rounded-lg p-4 max-w-md w-full">
                    <form onSubmit={handleSubmit} className="space-y-4">
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

                        <div className="flex justify-center gap-2">
                            <button className="px-4 py-2 bg-sky-500 text-sm font-medium text-gray-100 rounded-lg hover:bg-sky-400 cursor-pointer" type="submit">{editingId === null ? "Add Interview Stage" : "Save Changes"}</button> 
                            <button className="px-4 py-2 bg-gray-700 text-sm font-medium text-gray-100 rounded-lg hover:bg-gray-600 cursor-pointer" type="button" onClick={() => handleCancel()}>Cancel</button>
                        </div>
                    </form>
               </div>
            </div>
           )}

        </div>
    )
}

export default InterviewStages