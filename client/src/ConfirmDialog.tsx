import { AlertTriangle } from 'lucide-react'
//This replaces window.confirm when deleting companies and application which tells the user deleting an item will delete other items.
//used before every destructive delete action across four differnt componetns.

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmDialogProps) {
     if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
            <div className="card-elevated w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-3">
                    <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-rose-500/10 text-rose-400">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-100">{title}</h2>
                        <p className="mt-1 text-sm text-slate-400">{message}</p>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
                    <button type="button" className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    )
}

export default ConfirmDialog
