import { useState } from 'react'
//built-in TypeScript type meaning "anything react can render"
import type { ReactNode } from 'react'
import { ErrorContext } from './ErrorContext'

//Holds the actual current message and wraps your whole app so the message is reachable from anywhere inside it

interface ErrorProviderProps {
    children: ReactNode;
}

//children - special prop name, react automatically passes anything nested here into that component as a prop called children
export function ErrorProvider({children}: ErrorProviderProps){
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    //every context you create with createContext comes with a Provider component.
    //value is the actual data being shared
    //Provider broadcasts a real value onto the channel for everything nested inside it
    return(
        <ErrorContext.Provider value={{errorMessage, setErrorMessage}}>
            {children}
        </ErrorContext.Provider>
    )
}