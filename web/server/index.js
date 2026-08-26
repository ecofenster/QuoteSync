import express from 'express';
import cors from 'cors';
import clientsRoute from './routes/clients.js';
import estimatesRoute from './routes/estimates.js';
import clientNotesRoute from './routes/clientNotes.js';
import estimateNotesRoute from './routes/estimateNotes.js';
import followupsRoute from './routes/followups.js';
import notesRoute from './routes/notes.js';
import settingsRoute from './routes/settings.js';
import integrationsRoute from './routes/integrations.js';
import configuratorCatalogRoute from './routes/configuratorCatalog.js';
import { createSupplierQuotesRouter } from './routes/supplierQuotes.js';
import { createSupplierImportLabRouter } from './routes/supplierImportLab.js';
import { createProjectCalculatorLabRouter } from './routes/projectCalculatorLab.js';
import { createManufacturerPositionVisualsRouter } from './routes/manufacturerPositionVisuals.js';
import { createCommunicationsRouter } from './routes/communications.js';
import { createDriveRouter } from './routes/drive.js';
import { createQuotationWorkflowRouter } from './routes/quotationWorkflow.js';
import { fetchCentralExchangeRate } from './features/projectCalculatorLab/exchangeRateProvider.js';
import { dbPromise } from './db.js';
import { startApiServer } from './apiServerStartup.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.use('/api/clients', clientsRoute);
app.use('/api/estimates', estimatesRoute);
app.use('/api/client-notes', clientNotesRoute);
app.use('/api/estimate-notes', estimateNotesRoute);
app.use('/api/followups', followupsRoute);
app.use('/api/notes', notesRoute);
app.use('/api/settings', settingsRoute);
app.use('/api/integrations', integrationsRoute);
app.use('/api/configurator-catalog', configuratorCatalogRoute);
app.use('/api/manufacturer-position-visuals', createManufacturerPositionVisualsRouter());
app.use('/api/communications', createCommunicationsRouter());
app.use('/api/drive', createDriveRouter());
app.use('/api/quotation-workflow', createQuotationWorkflowRouter());
app.use('/api/estimates', await createSupplierQuotesRouter({ dbPromise }));
app.use('/api/admin/supplier-import-lab', await createSupplierImportLabRouter({ dbPromise }));
app.use('/api/admin/project-calculator-lab', await createProjectCalculatorLabRouter({ dbPromise }));

app.get('/api/fx-rate', async (req, res) => {
  const from = String(req.query.from || 'EUR').trim() || 'EUR';

  try {
    const data = await fetchCentralExchangeRate(from);
    return res.json({
      rate: data.rawRate,
      date: data.quotedAt,
      source: data.provider
    });
  } catch (err) {
    return res.status(500).json({ error: 'FX fetch failed' });
  }
});

startApiServer(app, { port: Number(process.env.PORT || 3001) });
