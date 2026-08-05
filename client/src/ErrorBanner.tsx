import { useError } from './useError'


function ErrorBanner(){
    const {errorMessage, setErrorMessage } = useError();

    return(
        <div>
            {errorMessage !== null && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full bg-rose-500 text-gray-100 rounded-lg shadow-lg px-4 py-3 flex items-center justify-between gap-4">
                    <p className="text-sm font-medium">{errorMessage}</p>
                    <button onClick={() => setErrorMessage(null)} className="text-gray-100 hover:text-gray-200 font-bold text-lg leading-none">×</button>
                </div>    
            )}
        </div>
    )
}

export default ErrorBanner