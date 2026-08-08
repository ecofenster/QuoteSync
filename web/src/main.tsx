import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initialiseQuoteSyncTheme, loadCompanyThemeConfiguration } from './theme/themes.ts'

initialiseQuoteSyncTheme()
void loadCompanyThemeConfiguration()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
