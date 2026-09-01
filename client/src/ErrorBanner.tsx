import { useEffect } from 'react'
import { useError } from './useError'
import { AlertCircle, X } from 'lucide-react'


function ErrorBanner(){
    const {errorMessage, setErrorMessage } = useError();

    useEffect(() => {
        if(errorMessage === null){
            return;
        }
        const timer = setTimeout(() => setErrorMessage(null), 6000);
        return () => clearTimeout(timer);
    }, [errorMessage, setErrorMessage]);

    if(errorMessage === null){
        return null;
    }

    return(
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] animate-toast-in">
            <div className="flex items-start gap-3 bg-rose-500 text-white rounded-xl shadow-2xl shadow-black/40 px-4 py-3">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="text-sm font-medium flex-1">{errorMessage}</p>
                <button onClick={() => setErrorMessage(null)} className="shrink-0 text-white/80 hover:text-white cursor-pointer" aria-label="Dismiss">
                    <X size={16} />
                </button>
            </div>
        </div>
    )
}

export default ErrorBanner
