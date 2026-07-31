import { useAuth } from '@clerk/react'
import { API_URL } from './config'

//we use useApi because we need getToken
//getToken is a hook and can onlu be called from inside a react component.
export function useApi(){
    const { getToken } = useAuth();

    function apiFetch(path: string, options: RequestInit = {}){
        //we need returns because apiFetch needs to return something that behaves like a promise otherwise it'll give undefined
        return getToken().then((token) => {
            return fetch(`${API_URL}${path}`, {
                ...options,
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${token}`,
                },
            })
            .then((response) => {
                if(!response.ok){
                    throw new Error('Request failed');
                }
                return response.json();
            })
        })
    }

    return apiFetch;
}