import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner' // 1. Import the Toaster
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 2. Place Toaster here. 'richColors' makes success/error look better */}
    <Toaster richColors position="top-right" closeButton />
    <App />
  </StrictMode>,
)