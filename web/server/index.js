import express from 'express';
import cors from 'cors';
import clientsRoute from './routes/clients.js';
import estimatesRoute from './routes/estimates.js';
import clientNotesRoute from './routes/clientNotes.js';
import estimateNotesRoute from './routes/estimateNotes.js';
import followupsRoute from './routes/followups.js';
import notesRoute from './routes/notes.js';
import settingsRoute from './routes/settings.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/clients', clientsRoute);
app.use('/api/estimates', estimatesRoute);
app.use('/api/client-notes', clientNotesRoute);
app.use('/api/estimate-notes', estimateNotesRoute);
app.use('/api/followups', followupsRoute);
app.use('/api/notes', notesRoute);
app.use('/api/settings', settingsRoute);

app.get('/api/fx-rate', async (req, res) => {
  const from = String(req.query.from || 'EUR').trim() || 'EUR';

  try {
    const response = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=GBP`);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'FX fetch failed' });
    }

    const data = await response.json();

    return res.json({
      rate: data?.rates?.GBP || null,
      date: data?.date || null,
      source: 'frankfurter'
    });
  } catch (err) {
    return res.status(500).json({ error: 'FX fetch failed' });
  }
});

app.listen(3001, () => {
  console.log('SQLite API running on http://localhost:3001');
});