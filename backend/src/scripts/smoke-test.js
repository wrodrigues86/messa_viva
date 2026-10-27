import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminAccount } from '../services/admin.js';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'mesa-viva-smoke-'));
const port = await new Promise((resolve, reject) => { const listener = net.createServer(); listener.once('error', reject); listener.listen(0, '127.0.0.1', () => { const value = listener.address().port; listener.close(() => resolve(value)); }); });
const env = { ...process.env, PORT: String(port), DB_PATH: path.join(temp, 'test.sqlite'), UPLOAD_DIR: path.join(temp, 'uploads'), JWT_SECRET: randomBytes(48).toString('hex'), FRONTEND_ORIGIN: 'http://localhost:5173', COOKIE_SECURE: 'false' };
Object.assign(process.env, env);
const base = `http://127.0.0.1:${port}/api`;
const email = `smoke-${randomUUID().slice(0, 8)}@mesa-viva.invalid`;
const password = randomBytes(20).toString('base64url');
let server;
let testDb;

async function call(route, { method = 'GET', body, cookie, establishment, form } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  if (establishment) headers.set('x-establishment-id', establishment);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${base}${route}`, { method, headers, body: form || (body === undefined ? undefined : JSON.stringify(body)) });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, data };
}

async function expectStatus(route, options, status) {
  const result = await call(route, options);
  assert.equal(result.response.status, status, `${options?.method || 'GET'} ${route}: ${JSON.stringify(result.data)}`);
  return result;
}

try {
  testDb = (await import('../database/index.js')).db;
  await createAdminAccount({ name: 'Smoke Administrator', email, password }, testDb);
  server = (await import('../server.js')).server;
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { const response = await fetch(`${base}/health`); if (response.ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.ok(ready, 'API did not start.');

  await expectStatus('/auth/login', { method: 'POST', body: { email, password: 'incorrect-password' } }, 401);
  const login = await expectStatus('/auth/login', { method: 'POST', body: { email, password } }, 200);
  const adminCookie = login.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(adminCookie, 'Login did not issue a session cookie.');
  await expectStatus('/auth/me', { cookie: adminCookie }, 200);

  const created = await expectStatus('/establishments', { method: 'POST', cookie: adminCookie, body: { name: 'Casa Smoke', description: 'Teste automatizado', address: 'Rua da Mesa, 10', phone: '11999990000', owner_name: 'Casa Smoke Owner', owner_email: `owner-${email}`, owner_password: password } }, 201);
  const first = created.data;
  const second = (await expectStatus('/establishments', { method: 'POST', cookie: adminCookie, body: { name: 'Balcão Smoke' } }, 201)).data;

  const cat = (await expectStatus('/categories', { method: 'POST', cookie: adminCookie, establishment: first.id, body: { name: 'Pratos', description: 'Da cozinha' } }, 201)).data;
  const cat2 = (await expectStatus('/categories', { method: 'POST', cookie: adminCookie, establishment: first.id, body: { name: 'Bebidas' } }, 201)).data;
  await expectStatus(`/categories/${cat2.id}`, { method: 'PUT', cookie: adminCookie, establishment: first.id, body: { name: cat2.name, description: '', active: true, sort_order: 0 } }, 200);
  const sorted = await expectStatus('/categories', { cookie: adminCookie, establishment: first.id }, 200);
  assert.equal(sorted.data[0].id, cat2.id, 'Category sort order was not saved.');

  const product = (await expectStatus('/products', { method: 'POST', cookie: adminCookie, establishment: first.id, body: { category_id: cat.id, name: 'Sanduíche da Casa', description: 'Pão fresco e queijo', price: 28, promotional_price: 24, featured: true, available: true } }, 201)).data;
  await expectStatus(`/products/${product.id}`, { method: 'PUT', cookie: adminCookie, establishment: first.id, body: { category_id: cat.id, name: 'Sanduíche da Casa', description: 'Atualizado', price: 30, promotional_price: 25, featured: true, available: false } }, 200);
  const products = await expectStatus('/products', { cookie: adminCookie, establishment: first.id }, 200);
  assert.equal(products.data[0].available, 0);

  process.env.DB_PATH = env.DB_PATH;
  process.env.UPLOAD_DIR = env.UPLOAD_DIR;
  testDb = (await import('../database/index.js')).db;
  const ownerLogin = await expectStatus('/auth/login', { method: 'POST', body: { email: `owner-${email}`, password } }, 200);
  const ownerCookie = ownerLogin.response.headers.get('set-cookie')?.split(';')[0];
  await expectStatus('/categories', { cookie: ownerCookie, establishment: first.id }, 200);
  await expectStatus('/categories', { cookie: ownerCookie, establishment: second.id }, 403);
  await expectStatus(`/establishments/${second.id}`, { method: 'PUT', cookie: ownerCookie, body: { name: 'Tentativa não autorizada' } }, 403);

  const form = new FormData();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p2sAAAAASUVORK5CYII=', 'base64');
  form.append('image', new Blob([png], { type: 'image/png' }), 'logo.png');
  const uploadResult = await expectStatus('/uploads', { method: 'POST', cookie: ownerCookie, establishment: first.id, form }, 201);
  assert.match(uploadResult.data.url, /^\/uploads\//);
  assert.equal((await fetch(`http://127.0.0.1:${port}${uploadResult.data.url}`)).status, 200);

  const updated = await expectStatus(`/establishments/${first.id}`, { method: 'PUT', cookie: adminCookie, body: { ...first, logo_url: uploadResult.data.url, primary_color: '#174f3d', accent_color: '#e7a83e', published: true } }, 200);
  assert.equal(updated.data.published, 1);
  const menu = await expectStatus(`/public/${first.slug}`, {}, 200);
  assert.equal(menu.data.products[0].name, 'Sanduíche da Casa');
  assert.equal(menu.data.establishment.logo_url, uploadResult.data.url);

  await expectStatus(`/products/${product.id}`, { method: 'DELETE', cookie: adminCookie, establishment: first.id }, 204);
  await expectStatus(`/categories/${cat.id}`, { method: 'DELETE', cookie: adminCookie, establishment: first.id }, 204);
  await expectStatus(`/establishments/${second.id}`, { method: 'DELETE', cookie: adminCookie }, 204);
  await expectStatus('/auth/logout', { method: 'POST', cookie: ownerCookie }, 200);
  await expectStatus('/auth/me', { cookie: ownerCookie }, 401);
  console.log('Smoke test passed: administrator creation, login/logout, tenant boundary, CRUD, category order, upload and public menu.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  testDb?.close();
  await fs.rm(temp, { recursive: true, force: true });
}
