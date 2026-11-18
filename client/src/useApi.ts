import { useCallback } from 'react'
import { useAuth } from '@clerk/react'
import { API_URL } from './config'

//Turns a failed response into a readable message.
//The body might be JSON, an HTML page (e.g. a 413 from the server) or empty, so we never assume it is JSON.
async function errorMessageFor(response: Response): Promise<string> {
    try {
        const data = await response.json();
        if (typeof data?.error === 'string' && data.error !== '') return data.error;
    } catch {
        // body was not JSON, fall through to the status-based messages
    }
    if (response.status === 413) return 'Request too large';
    return `Request failed (${response.status})`;
}

//we use useApi because we need getToken
//getToken is a hook and can onlu be called from inside a react component.
export function useApi(){
    const { getToken } = useAuth();

    //useCallback keeps the same function between renders (it only changes if getToken does).
    //That lets components list apiFetch in a useEffect dependency array without re-running the effect on every render.
    const apiFetch = useCallback(async (path: string, options: RequestInit = {}) => {
        const token = await getToken();
        let response: Response;
        try {
            response = await fetch(`${API_URL}${path}`, {
                ...options,
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${token}`,
                },
            });
        } catch {
            // fetch only throws when the request never got an answer (server down, offline)
            throw new Error("Can't reach the server. Is it running?");
        }
        if (!response.ok) {
            throw new Error(await errorMessageFor(response));
        }
        return response.json();
    }, [getToken]);

    return apiFetch;
}
