import express from 'express';
import { dbPromise } from '../db.js';

const router = express.Router();

function normalizeBooleanFlag(value) {
  return value ? 1 : 0;
}

function normalizeAddress(address) {
  const source = address && typeof address === 'object' ? address : {};
  return {
    line1: String(source.line1 || ''),
    line2: String(source.line2 || ''),
    line3: String(source.line3 || ''),
    town: String(source.town || ''),
    city: String(source.city || ''),
    county: String(source.county || ''),
    postcode: String(source.postcode || ''),
  };
}

function parseAddressJson(raw) {
  if (!raw) return normalizeAddress({});
  try {
    return normalizeAddress(JSON.parse(raw));
  } catch {
    return normalizeAddress({});
  }
}

function normalizeCoordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

router.get('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const clients = await db.all(`
      SELECT
        id,
        name,
        email,
        phone,
        mobile,
        home,
        project_name,
        created_at,
        client_ref,
        client_type,
        contact_name,
        company_name,
        customer_address,
        project_address,
        invoice_address,
        invoice_same_as_customer,
        invoice_same_as_project,
        customer_address_json,
        project_address_json,
        invoice_address_json,
        what3words,
        latitude,
        longitude
      FROM clients
      ORDER BY rowid DESC
    `);

    res.json(
      clients.map((row) => ({
        ...row,
        customer_address_json: parseAddressJson(row.customer_address_json),
        project_address_json: parseAddressJson(row.project_address_json),
        invoice_address_json: parseAddressJson(row.invoice_address_json),
        what3words: String(row.what3words || ''),
        latitude: normalizeCoordinate(row.latitude),
        longitude: normalizeCoordinate(row.longitude),
      }))
    );
  } catch (error) {
    console.error('GET /api/clients failed', error);
    res.status(500).json({ error: 'Failed to load clients' });
  }
});

router.post('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const {
      id,
      name,
      email,
      phone,
      mobile,
      home,
      project_name,
      created_at,
      client_ref,
      client_type,
      contact_name,
      company_name,
      customer_address,
      project_address,
      invoice_address,
      invoice_same_as_customer,
      invoice_same_as_project,
      customer_address_json,
      project_address_json,
      invoice_address_json,
      what3words,
      latitude,
      longitude,
    } = req.body ?? {};

    await db.run(
      `
        INSERT INTO clients (
          id,
          name,
          email,
          phone,
          mobile,
          home,
          project_name,
          created_at,
          client_ref,
          client_type,
          contact_name,
          company_name,
          customer_address,
          project_address,
          invoice_address,
          invoice_same_as_customer,
          invoice_same_as_project,
          customer_address_json,
          project_address_json,
          invoice_address_json,
          what3words,
          latitude,
          longitude
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id ?? '',
        name ?? '',
        email ?? '',
        phone ?? '',
        mobile ?? '',
        home ?? '',
        project_name ?? '',
        created_at ?? new Date().toISOString(),
        client_ref ?? '',
        client_type ?? 'Individual',
        contact_name ?? '',
        company_name ?? '',
        customer_address ?? '',
        project_address ?? '',
        invoice_address ?? '',
        normalizeBooleanFlag(invoice_same_as_customer),
        normalizeBooleanFlag(invoice_same_as_project),
        JSON.stringify(normalizeAddress(customer_address_json)),
        JSON.stringify(normalizeAddress(project_address_json)),
        JSON.stringify(normalizeAddress(invoice_address_json)),
        String(what3words || ''),
        normalizeCoordinate(latitude),
        normalizeCoordinate(longitude),
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/clients failed', error);
    res.status(500).json({ error: 'Failed to save client' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const db = await dbPromise;
    const {
      name,
      email,
      phone,
      mobile,
      home,
      project_name,
      client_ref,
      client_type,
      contact_name,
      company_name,
      customer_address,
      project_address,
      invoice_address,
      invoice_same_as_customer,
      invoice_same_as_project,
      customer_address_json,
      project_address_json,
      invoice_address_json,
      what3words,
      latitude,
      longitude,
    } = req.body ?? {};

    await db.run(
      `
        UPDATE clients
        SET
          name = ?,
          email = ?,
          phone = ?,
          mobile = ?,
          home = ?,
          project_name = ?,
          client_ref = ?,
          client_type = ?,
          contact_name = ?,
          company_name = ?,
          customer_address = ?,
          project_address = ?,
          invoice_address = ?,
          invoice_same_as_customer = ?,
          invoice_same_as_project = ?,
          customer_address_json = ?,
          project_address_json = ?,
          invoice_address_json = ?,
          what3words = ?,
          latitude = ?,
          longitude = ?
        WHERE id = ?
      `,
      [
        name ?? '',
        email ?? '',
        phone ?? '',
        mobile ?? '',
        home ?? '',
        project_name ?? '',
        client_ref ?? '',
        client_type ?? 'Individual',
        contact_name ?? '',
        company_name ?? '',
        customer_address ?? '',
        project_address ?? '',
        invoice_address ?? '',
        normalizeBooleanFlag(invoice_same_as_customer),
        normalizeBooleanFlag(invoice_same_as_project),
        JSON.stringify(normalizeAddress(customer_address_json)),
        JSON.stringify(normalizeAddress(project_address_json)),
        JSON.stringify(normalizeAddress(invoice_address_json)),
        String(what3words || ''),
        normalizeCoordinate(latitude),
        normalizeCoordinate(longitude),
        req.params.id,
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('PUT /api/clients/:id failed', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

export default router;