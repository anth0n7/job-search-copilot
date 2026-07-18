import { useState, useEffect } from 'react'
import type { Company } from './types';
import Companies from './Companies';
import Applications from './Applications';


//lifting state up: when two or more components need the same piece of state
//you lift that state to their nearest common parent, then hand it down to who needs it

function App() {
  const [companies, setCompanies] = useState<Company[]>([]);


  useEffect(() =>{
    fetch('http://localhost:3001/companies')
    .then((response) => response.json())
    .then((data) =>{
      setCompanies(data);
    })
    .catch((err) => {
      console.error('Failed to fetch companies:', err);
    })
  }, []);


  return (
    <div>
      <h1>Job Search Copilot</h1>
      <Companies companies={companies} setCompanies={setCompanies} />
      <Applications companies={companies} />
    </div>
  );
}

export default App;


