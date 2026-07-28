import { useState, useEffect } from 'react'
import { Show, SignInButton, SignUpButton, UserButton} from '@clerk/react';
import type { Company, Application } from './types';
import Companies from './Companies';
import Applications from './Applications';
import Contacts from './Contacts';
import InterviewStages from './InterviewStages';



//lifting state up: when two or more components need the same piece of state
//you lift that state to their nearest common parent, then hand it down to who needs it

function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);


  useEffect(() =>{
    fetch('http://localhost:3001/companies')
    .then((response) =>{
      if(!response.ok){
        throw new Error('Response failed');
      }
      return response.json()        
    })
    .then((data) =>{
      setCompanies(data);
    })
    .catch((err) => {
      console.error('Failed to fetch companies:', err);
    })
  }, []);

  useEffect(() =>{
        fetch('http://localhost:3001/applications')
        .then((response) => {
            if (!response.ok) {
                throw new Error('Request failed');
            }
            return response.json();
        })
        .then((data) =>{
            setApplications(data);
        })
        .catch((err) =>{
            console.error('Failed to fetch applications', err);
        })
    }, []);

  // show when is clerks way of conditionally rendering
  return (
    <div>
      <Show when="signed-out">
        <SignInButton mode="modal" />
        <SignUpButton mode="modal" />
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>

      <h1>Job Search Copilot</h1>
      <Companies companies={companies} setCompanies={setCompanies} />
      <Applications companies={companies} applications={applications} setApplications={setApplications}/>
      <Contacts companies={companies} />
      <InterviewStages companies={companies} applications={applications} />
    </div>
  );
}

export default App;


