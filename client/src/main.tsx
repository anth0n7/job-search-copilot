import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider} from '@clerk/react'
import './index.css'
import App from './App.tsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

//clerk provider is called a context provider - a react pattern for making some piece of data
//available to every component in your app, no matter how deeply nested, without manually passing it down as props through every layer
createRoot(document.getElementById('root')!).render(
  <StrictMode>
   <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </StrictMode>,
)
