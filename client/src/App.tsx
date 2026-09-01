import { useState, useEffect } from 'react'
import { Show, SignInButton, SignUpButton, UserButton} from '@clerk/react';
import type { Company, Application } from './types';
import Companies from './Companies';
import Applications from './Applications';
import Resumes from './Resumes'
import ApplicationDetail from './ApplicationDetail'
import { Routes, Route, Navigate, NavLink } from 'react-router'
import { useApi } from './useApi'
import { useError } from './useError'
import ErrorBanner from './ErrorBanner';
import { Briefcase, Building2, FileText } from 'lucide-react';






//lifting state up: when two or more components need the same piece of state
//you lift that state to their nearest common parent, then hand it down to who needs it


function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isLoadingApplications, setIsLoadingApplications] = useState(true);
  const apiFetch = useApi();
  const { setErrorMessage } = useError();
  //useAuth() returns an object with several things on it

  //creating a callback prop - to notify the parent that something happened
  //this is handling our on cascade delete
  function fetchApplications() {
    apiFetch('/applications')
    .then((data) => {setApplications(data);})
    .catch((err) => {console.error('Failed to fetch applications', err)
      setErrorMessage(err.message);
    })
    .finally(() => setIsLoadingApplications(false));
}

  //get token returns a promise (async). Fetch can't run until getToken resolves
  useEffect(() =>{
    apiFetch('/companies')
      .then((data) =>{setCompanies(data)})
      .catch((err) => {console.error('Failed to fetch companies:', err);
        setErrorMessage(err.message);
      })
      .finally(() => setIsLoadingCompanies(false));
  }, []);

 
  useEffect(() =>{
    fetchApplications();
    }, []);

    const navLinkClass = ({ isActive }: {isActive: boolean}) =>
      `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
      isActive ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
    }`;

  // show when is clerks way of conditionally rendering
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <h1 className="text-lg font-semibold tracking-tight text-slate-100">Job Search Copilot</h1>
            <nav className="flex gap-1">
              <NavLink to="/companies" className={navLinkClass}>
                <Building2 size={16} />
                Companies
              </NavLink>
              <NavLink to="/applications" className={navLinkClass}>
                <Briefcase size={16} />
                Applications
              </NavLink>
              <NavLink to="/resumes" className={navLinkClass}>
                <FileText size={16} />
                Resume
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="btn-secondary">Sign in</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="btn-primary">Sign up</button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      <ErrorBanner />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/applications" replace />} />
          <Route path='/resumes' element={<Resumes />} />
          <Route path="/companies" element={<Companies companies={companies} applications={applications} setCompanies={setCompanies} onCompanyDeleted={fetchApplications} isLoading={isLoadingCompanies} />} />
          <Route path="/applications" element={<Applications companies={companies} applications={applications} setApplications={setApplications} isLoading={isLoadingApplications} />} />
          <Route path="/applications/:id" element={<ApplicationDetail companies={companies} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;


