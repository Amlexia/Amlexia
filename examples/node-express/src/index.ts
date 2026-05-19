import express from 'express';
import { AmlexiaClient } from '@amlexia/node';
import { AmlexiaMiddleware } from '@amlexia/node/express';

const app = express();
const port = 3456;

const client = new AmlexiaClient({
  sdkKey: process.env.AMLEXIA_SDK_KEY ?? '',
  ingestUrl: process.env.AMLEXIA_INGEST_URL ?? 'http://localhost:8787',
});

app.use(AmlexiaMiddleware(client));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Jane Doe' });
});

app.post('/api/orders', (_req, res) => {
  res.status(201).json({ orderId: 'ord_123' });
});

app.listen(port, () => {
  console.log(`Example API running at http://localhost:${port}`);
  console.log('Hit endpoints to send events to Amlexia');
});
