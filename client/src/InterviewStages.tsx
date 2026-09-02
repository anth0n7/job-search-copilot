import { useState, useEffect } from 'react'
import type { InterviewStage } from './types';
import { useApi } from './useApi'
import { useError } from './useError'
import { Trash2, Pencil, Plus, Check, X, CalendarClock} from 'lucide-react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';



interface InterviewStagesProps{
   applicationID: number;
}

function InterviewStages({applicationID} : InterviewStagesProps){
    const [interview_stages, setInterviewStages] = useState<InterviewStage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stage_name, setStageName] = useState('');
    const [scheduled_date, setScheduledDate] = useState('');
    const [completed, setCompleted] = useState<boolean>(false);
    const [notes, setNotes] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const apiFetch = useApi();
    const {setErrorMessage} = useError();


    //[applicationID] is a dependancy array. If applicationId changes run the effect again
    useEffect(() => {
        apiFetch(`/applications/${applicationID}/interview_stages`)
        .then((data) => {setInterviewStages(data);})
        .catch((err) =>{console.error("Failed to fetch interview stages:", err);
            setErrorMessage(err.message);
        })
        .finally(() => setIsLoading(false));
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
        .finally(() => setPendingDeleteId(null));
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
            <h1 className="section-title text-center mb-3">Interview Stages</h1>

            {isLoading && (
                <div className="max-w-md mx-auto space-y-3">
                    <div className="skeleton h-24" />
                </div>
            )}

            {!isLoading && interview_stages.length === 0 && (
                <div className="max-w-md mx-auto text-center py-4">
                    <CalendarClock size={22} className="mx-auto text-slate-500 mb-2" />
                    <p className="muted text-sm">No interview stages yet</p>
                </div>
            )}

            {!isLoading && interview_stages.length > 0 && (
                <div className="max-w-md mx-auto space-y-3">
                   {interview_stages.map((interview_stage) => (
                    <div key={interview_stage.id} className="card p-4">
                        <div className="flex gap-1 p-0.5">
                            <span className="font-medium">Name:</span>
                            <p> {interview_stage.stage_name}</p>
                        </div>

                        <div className="flex gap-1 p-0.5">
                            <span className="font-medium">Scheduled Date:</span>
                            <p>{interview_stage.scheduled_date ? new Date(interview_stage.scheduled_date).toLocaleString() : 'Not Scheduled'}</p>
                        </div>

                        <div className="flex gap-1 p-0.5">
                            <span className="font-medium">Completed:</span>
                            <p>{interview_stage.completed ? "Yes" : "No"}</p>
                        </div>

                        <div className="flex gap-1 p-0.5">
                            <span className="font-medium">Notes:</span>
                            <p>{interview_stage.notes}</p>
                        </div>

                        <div className="mt-2 flex gap-2">
                            <button className="btn-danger" onClick={() => setPendingDeleteId(interview_stage.id)}>
                                <Trash2 size={16} />
                                Delete
                            </button>
                            <button className="btn-primary" onClick={() => handleEdit(interview_stage)}>
                                <Pencil size={16} />
                                Edit Interview Stage
                            </button>
                        </div>
                    </div>
                   ))}
                </div>
            )}

            <div className="flex justify-center mt-3">
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={16} />
                    Add Interview Stage
                </button>
            </div>

           {isModalOpen && (
             <Modal title={editingId === null ? "Add Interview Stage" : "Edit Interview Stage"} onClose={handleCancel}>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <label className="form-label" htmlFor="stage_name">Stage Name</label>
                        <input id="stage_name" className="input-field" value={stage_name} onChange={(e) => setStageName(e.target.value)}/>

                        <label className="form-label" htmlFor="scheduled_date">Scheduled Date</label>
                        <input id="scheduled_date" className="input-field" value={scheduled_date} type="datetime-local" onChange={(e) => setScheduledDate(e.target.value)}/>

                        <div className="flex items-center gap-2">
                            <input id="completed" checked={completed} type="checkbox" className="h-5 w-5 rounded border-white/10 bg-slate-950/60 text-sky-500 focus:ring-2 focus:ring-sky-500" onChange={(e) => setCompleted(e.target.checked)}/>
                            <label htmlFor="completed" className="text-sm font-medium text-slate-300">Completed</label>
                        </div>

                        <label className="form-label" htmlFor="notes">Notes</label>
                        <input id="notes" className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)}/>

                        <div className="flex justify-end gap-2">
                            <button className="btn-secondary" type="button" onClick={() => handleCancel()}>
                                <X size={16} />
                                Cancel
                            </button>
                            <button className="btn-primary" type="submit">
                                {editingId === null ? <Plus size={16} />: <Check size={16} />}
                                {editingId === null ? "Add Interview Stage" : "Save Changes"}
                            </button>
                        </div>
                    </form>
             </Modal>
           )}

            <ConfirmDialog
                open={pendingDeleteId !== null}
                title="Delete interview stage?"
                message="This will permanently remove this interview stage."
                onConfirm={() => pendingDeleteId !== null && handleDelete(pendingDeleteId)}
                onCancel={() => setPendingDeleteId(null)}
            />

        </div>
    )
}

export default InterviewStages
