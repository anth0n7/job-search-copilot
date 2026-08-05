import { useContext } from 'react'
import { ErrorContext } from './ErrorContext'


export function useError(){
    //useContext is how any nested component "tunes in" to the channel and reads what is being broadcast
    //gets the value from the nearest provider wrapping bascially
    const context = useContext(ErrorContext);
    if(context === undefined){
        throw new Error('useError must be used within an Error Provider');
    }
    return context;
}