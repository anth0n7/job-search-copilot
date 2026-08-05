import { createContext } from 'react'
//defines the "shape" of the shared data (current error message, and a function to set/clear it)
//Describes what's allowed to appear and a way to update it

interface ErrorContextType{
    errorMessage: string | null;
    setErrorMessage: (message: string | null) => void;
}

//createContext creates a "channel". Nothing is being broadcasted on it yet; it's just waiting to be used
export const ErrorContext = createContext<ErrorContextType | undefined>(undefined);