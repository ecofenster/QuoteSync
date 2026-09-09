import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ClientPortalExternalApp from './features/clientPortal/ClientPortalExternalApp.tsx'
import { initialiseQuoteSyncTheme, loadCompanyThemeConfiguration } from './theme/themes.ts'
import { initialiseQuoteSuiteVisualTheme } from './theme/visualDesignV2.ts'

initialiseQuoteSyncTheme()
initialiseQuoteSuiteVisualTheme()
void loadCompanyThemeConfiguration().then(initialiseQuoteSuiteVisualTheme)

const RootApplication = window.location.hash.startsWith('#/client-portal') ? ClientPortalExternalApp : App
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApplication />
  </StrictMode>,
)
