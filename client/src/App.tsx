import { useState, useEffect } from 'react'
import { Show, SignInButton, SignUpButton, UserButton} from '@clerk/react';
import type { Company, Application } from './types';
import Companies from './Companies';
import Applications from './Applications';
import ApplicationDetail from './ApplicationDetail'
import { Routes, Route, Navigate, Link } from 'react-router'
import { useApi } from './useApi'




//lifting state up: when two or more components need the same piece of state
//you lift that state to their nearest common parent, then hand it down to who needs it


function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const apiFetch = useApi();
  //useAuth() returns an object with several things on it

  //creating a callback prop - to notify the parent that something happened
  //this is handling our on cascade delete
  function fetchApplications() {
    apiFetch('/applications')
    .then((data) => {setApplications(data);})
    .catch((err) => {console.error('Failed to fetch applications', err)});
}

  //get token returns a promise (async). Fetch can't run until getToken resolves
  useEffect(() =>{
    apiFetch('/companies')
      .then((data) =>{setCompanies(data)})
      .catch((err) => {console.error('Failed to fetch companies:', err)})
  }, []);

 
  useEffect(() =>{
    fetchApplications();
    }, []);

  // show when is clerks way of conditionally rendering
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <Show when="signed-out">
        <SignInButton mode="modal" />
        <SignUpButton mode="modal" />
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>

      <h1 className="text-2xl font-bold text-gray-100 mb-5">Job Search Copilot</h1>

      <nav className="flex gap-4 mb-4">
        <Link to="/companies">Companies</Link> 
        <Link to="/applications">Applications</Link> 
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/applications" replace />} />
        <Route path="/companies" element={<Companies companies={companies} setCompanies={setCompanies} onCompanyDeleted={fetchApplications} />} />
        <Route path="/applications" element={<Applications companies={companies} applications={applications} setApplications={setApplications}/>} />
        <Route path="/applications/:id" element={<ApplicationDetail companies={companies} />} />
      </Routes>

    </div>
  );
}

export default App;


