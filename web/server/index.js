import express from 'express';
import cors from 'cors';
import clientsRoute from './routes/clients.js';
import estimatesRoute from './routes/estimates.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/clients', clientsRoute);
app.use('/api/estimates', estimatesRoute);

app.listen(3001, () => {
  console.log('SQLite API running on http://localhost:3001');
});
