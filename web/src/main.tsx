import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initialiseQuoteSyncTheme, loadCompanyThemeConfiguration } from './theme/themes.ts'
import { initialiseQuoteSuiteVisualTheme } from './theme/visualDesignV2.ts'

initialiseQuoteSyncTheme()
initialiseQuoteSuiteVisualTheme()
void loadCompanyThemeConfiguration().then(initialiseQuoteSuiteVisualTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
