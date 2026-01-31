import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OverviewCanvas } from './components/views/OverviewCanvas'
import { AuthProvider } from './context/auth/AuthContext'
import { AIProvider } from './context/ai/AIContext'
import { ApiKeyProvider } from './context/apikey/ApiKeyContext'
import { ApiKeyDialog } from './components/apikey/ApiKeyDialog'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div data-vaul-drawer-wrapper="" className="h-full w-full flex flex-col">
      <ApiKeyProvider>
        <AuthProvider>
          <AIProvider>
            <OverviewCanvas />
            <ApiKeyDialog />
          </AIProvider>
        </AuthProvider>
      </ApiKeyProvider>
    </div>
  </StrictMode>,
)
