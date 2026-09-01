import type { ReactNode } from 'react'
import { X } from 'lucide-react'

//ReactNode = the reserved prop name for whatever gets nested between <Modal> and </Modal> at the call site
//onClose - required, a function that takes nothing and returns nothing. A call back prop so the child can tell the parent something happend meaning the user wants me closed
//? marks is optional. If the caller doesn't pass it, it's undefined inside the component unless something give it a fall back
interface ModalProps {
    title: string;
    onClose: () => void;
    children: ReactNode;
    maxWidth?: string;
}

//
function Modal({title, onClose, children, maxWidth = 'max-w-md' }: ModalProps ) {
    return(
        <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className={`card-elevated w-full ${maxWidth} max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h2 className="font-semibold text-slate-100">{title}</h2>
                    <button type="button" onClick={onClose} className="btn-ghost" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>    
    )
}

export default Modal