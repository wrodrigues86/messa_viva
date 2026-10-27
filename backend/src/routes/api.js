import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../database/index.js';
import { requireAuth, requireEstablishment, requirePlatformAdmin } from '../middleware/auth.js';
import { uploadsRoot } from '../config/uploads.js';

export const api = Router();
fs.mkdirSync(uploadsRoot, { recursive: true });
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const storage = multer.diskStorage({
  destination(req, file, cb) { const dir = path.join(uploadsRoot, req.establishmentId || 'pending'); fs.mkdirSync(dir, { recursive: true }); cb(null, dir); },
  filename(req, file, cb) { cb(null, `${randomUUID()}${extensions[file.mimetype] || '.img'}`); }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter(req, file, cb) { cb(null, Object.hasOwn(extensions, file.mimetype)); } });
const slugify = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'estabelecimento';
const text = (value, max = 500) => z.string().trim().max(max).default('').parse(value ?? '');
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const imageRef = z.string().max(500).refine((value) => value === '' || value.startsWith('/uploads/') || value.startsWith('https://'));

api.post('/auth/login', async (req, res) => {
  const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Informe um e-mail e senha válidos.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data.email.toLowerCase());
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  const sessionId = randomUUID();
  db.prepare('DELETE FROM user_sessions WHERE expires_at <= ?').run(Date.now());
  db.prepare('INSERT INTO user_sessions (id,user_id,expires_at) VALUES (?,?,?)').run(sessionId, user.id, Date.now() + 8 * 60 * 60 * 1000);
  const token = jwt.sign({ id: user.id, name: user.name, role: user.role, establishmentId: user.establishment_id }, process.env.JWT_SECRET, { expiresIn: '8h', jwtid: sessionId });
  res.cookie('mesa_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 8 * 60 * 60 * 1000 });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
api.post('/auth/register', async (req, res, next) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(120),
    establishment_name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    password: z.string().min(12).max(200)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Confira os dados e use uma senha com pelo menos 12 caracteres.' });
  const data = parsed.data;
  const email = data.email.toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Este e-mail j\u00e1 possui uma conta.' });
  try {
    const establishmentId = randomUUID();
    const ownerId = randomUUID();
    let slug = slugify(data.establishment_name);
    if (db.prepare('SELECT id FROM establishments WHERE slug = ?').get(slug)) slug += `-${establishmentId.slice(0, 8)}`;
    const passwordHash = await bcrypt.hash(data.password, 12);
    const sessionId = randomUUID();
    db.transaction(() => {
      db.prepare('INSERT INTO establishments (id,slug,name) VALUES (?,?,?)').run(establishmentId, slug, data.establishment_name);
      db.prepare('INSERT INTO users (id,email,password_hash,name,role,establishment_id) VALUES (?,?,?,?,?,?)').run(ownerId, email, passwordHash, data.name, 'owner', establishmentId);
      db.prepare('INSERT INTO user_sessions (id,user_id,expires_at) VALUES (?,?,?)').run(sessionId, ownerId, Date.now() + 8 * 60 * 60 * 1000);
    })();
    const token = jwt.sign({ id: ownerId, name: data.name, role: 'owner', establishmentId }, process.env.JWT_SECRET, { expiresIn: '8h', jwtid: sessionId });
    res.cookie('mesa_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 8 * 60 * 60 * 1000 });
    res.status(201).json({ user: { id: ownerId, name: data.name, email, role: 'owner' } });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Este e-mail j\u00e1 possui uma conta.' });
    next(error);
  }
});
api.post('/auth/logout', (req, res) => {
  const token = req.cookies?.mesa_session;
  if (token) { try { const payload = jwt.verify(token, process.env.JWT_SECRET); if (payload.jti) db.prepare('DELETE FROM user_sessions WHERE id = ?').run(payload.jti); } catch {} }
  res.clearCookie('mesa_session', { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true' });
  res.json({ ok: true });
});
api.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

api.get('/establishments', requireAuth, (req, res) => {
  const rows = req.user.role === 'platform_admin' ? db.prepare('SELECT id, name, slug FROM establishments ORDER BY created_at DESC').all() : db.prepare('SELECT * FROM establishments WHERE id = ?').all(req.user.establishmentId);
  res.json(rows);
});
api.get('/platform/overview', requireAuth, requirePlatformAdmin, (req, res) => {
  const establishments = db.prepare(`
    SELECT id, name, slug, published, created_at FROM establishments ORDER BY created_at DESC
  `).all();
  res.json({ establishments });
});
api.post('/establishments', requireAuth, (req, res) => res.status(403).json({ error: 'A cria\u00e7\u00e3o de estabelecimentos n\u00e3o est\u00e1 dispon\u00edvel.' }));
api.put('/establishments/:id', requireAuth, (req, res) => {
  if (req.user.role === 'platform_admin' || req.user.establishmentId !== req.params.id) return res.status(403).json({ error: 'Apenas o responsável pode alterar os dados do estabelecimento.' });
  const current = db.prepare('SELECT * FROM establishments WHERE id = ?').get(req.params.id); if (!current) return res.status(404).json({ error: 'Estabelecimento não encontrado.' });
  const schema = z.object({ name: z.string().trim().min(2).max(120).optional(), description: z.string().max(1000).optional(), address: z.string().max(300).optional(), phone: z.string().max(40).optional(), logo_url: imageRef.optional(), cover_url: imageRef.optional(), primary_color: hex.optional(), accent_color: hex.optional(), published: z.boolean().optional() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Revise os dados do estabelecimento.' });
  const body = parsed.data;
  db.prepare('UPDATE establishments SET name=?,description=?,address=?,phone=?,logo_url=?,cover_url=?,primary_color=?,accent_color=?,published=? WHERE id=?').run(body.name ?? current.name, body.description ?? current.description, body.address ?? current.address, body.phone ?? current.phone, body.logo_url ?? current.logo_url, body.cover_url ?? current.cover_url, body.primary_color ?? current.primary_color, body.accent_color ?? current.accent_color, (body.published ?? Boolean(current.published)) ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM establishments WHERE id = ?').get(req.params.id));
});
api.delete('/establishments/:id', requireAuth, requirePlatformAdmin, (req, res) => {
  if (!db.prepare('SELECT id FROM establishments WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Estabelecimento n\u00e3o encontrado.' });
  db.transaction(() => {
    db.prepare('DELETE FROM users WHERE establishment_id = ?').run(req.params.id);
    db.prepare('DELETE FROM establishments WHERE id = ?').run(req.params.id);
  })();
  res.status(204).end();
});

api.get('/categories', requireAuth, requireEstablishment, (req, res) => res.json(db.prepare('SELECT * FROM categories WHERE establishment_id=? ORDER BY sort_order,name').all(req.establishmentId)));
api.post('/categories', requireAuth, requireEstablishment, (req, res) => {
  const schema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(500).optional(), active: z.boolean().optional() }); const p = schema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Informe o nome da categoria.' });
  const id = randomUUID(); const order = db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM categories WHERE establishment_id=?').get(req.establishmentId).n;
  db.prepare('INSERT INTO categories (id,establishment_id,name,description,active,sort_order) VALUES (?,?,?,?,?,?)').run(id,req.establishmentId,p.data.name,p.data.description || '',p.data.active === false ? 0 : 1,order);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id=?').get(id));
});
api.put('/categories/:id', requireAuth, requireEstablishment, (req, res) => {
  const c = db.prepare('SELECT * FROM categories WHERE id=? AND establishment_id=?').get(req.params.id,req.establishmentId); if (!c) return res.status(404).json({ error: 'Categoria não encontrada.' });
  const p = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(500).optional(), active: z.boolean().optional(), sort_order: z.number().int().min(0).optional() }).safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Revise os dados da categoria.' });
  db.prepare('UPDATE categories SET name=?,description=?,active=?,sort_order=? WHERE id=? AND establishment_id=?').run(p.data.name,p.data.description || '',p.data.active === false ? 0 : 1,p.data.sort_order ?? c.sort_order,c.id,req.establishmentId); res.json(db.prepare('SELECT * FROM categories WHERE id=?').get(c.id));
});
api.delete('/categories/:id', requireAuth, requireEstablishment, (req, res) => { const out = db.prepare('DELETE FROM categories WHERE id=? AND establishment_id=?').run(req.params.id,req.establishmentId); if (!out.changes) return res.status(404).json({ error: 'Categoria não encontrada.' }); res.status(204).end(); });

api.get('/products', requireAuth, requireEstablishment, (req, res) => res.json(db.prepare('SELECT p.*,c.name AS category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE p.establishment_id=? ORDER BY p.created_at DESC').all(req.establishmentId)));
api.post('/products', requireAuth, requireEstablishment, (req, res) => {
  const schema = z.object({ category_id:z.string().uuid(), name:z.string().trim().min(1).max(120), description:z.string().max(1000).optional(), price:z.number().finite().nonnegative(), promotional_price:z.number().finite().nonnegative().nullable().optional(), available:z.boolean().optional(), featured:z.boolean().optional(), image_url:imageRef.optional() }); const p = schema.safeParse(req.body); if (!p.success) return res.status(400).json({ error: 'Revise nome, categoria e preço do produto.' });
  if (!db.prepare('SELECT id FROM categories WHERE id=? AND establishment_id=?').get(p.data.category_id,req.establishmentId)) return res.status(400).json({ error: 'A categoria escolhida não pertence a este estabelecimento.' });
  if (p.data.promotional_price != null && p.data.promotional_price >= p.data.price) return res.status(400).json({ error: 'O preço promocional deve ser menor que o preço normal.' });
  const id=randomUUID(); db.prepare('INSERT INTO products (id,establishment_id,category_id,name,description,price,promotional_price,available,featured,image_url) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,req.establishmentId,p.data.category_id,p.data.name,p.data.description || '',p.data.price,p.data.promotional_price ?? null,p.data.available === false ? 0 : 1,p.data.featured ? 1 : 0,p.data.image_url || ''); res.status(201).json(db.prepare('SELECT * FROM products WHERE id=?').get(id));
});
api.put('/products/:id', requireAuth, requireEstablishment, (req, res) => {
  const current=db.prepare('SELECT * FROM products WHERE id=? AND establishment_id=?').get(req.params.id,req.establishmentId); if (!current) return res.status(404).json({ error: 'Produto não encontrado.' });
  const p=z.object({ category_id:z.string().uuid(),name:z.string().trim().min(1).max(120),description:z.string().max(1000).optional(),price:z.number().finite().nonnegative(),promotional_price:z.number().finite().nonnegative().nullable().optional(),available:z.boolean().optional(),featured:z.boolean().optional(),image_url:imageRef.optional() }).safeParse(req.body); if(!p.success) return res.status(400).json({error:'Revise os dados do produto.'});
  if(!db.prepare('SELECT id FROM categories WHERE id=? AND establishment_id=?').get(p.data.category_id,req.establishmentId)) return res.status(400).json({error:'Categoria inválida.'}); if(p.data.promotional_price != null && p.data.promotional_price >= p.data.price) return res.status(400).json({error:'O preço promocional deve ser menor que o preço normal.'});
  db.prepare('UPDATE products SET category_id=?,name=?,description=?,price=?,promotional_price=?,available=?,featured=?,image_url=? WHERE id=? AND establishment_id=?').run(p.data.category_id,p.data.name,p.data.description||'',p.data.price,p.data.promotional_price ?? null,p.data.available === false?0:1,p.data.featured?1:0,p.data.image_url??current.image_url,current.id,req.establishmentId); res.json(db.prepare('SELECT * FROM products WHERE id=?').get(current.id));
});
api.delete('/products/:id', requireAuth, requireEstablishment, (req,res)=>{const out=db.prepare('DELETE FROM products WHERE id=? AND establishment_id=?').run(req.params.id,req.establishmentId);if(!out.changes)return res.status(404).json({error:'Produto não encontrado.'});res.status(204).end();});

api.post('/uploads', requireAuth, requireEstablishment, (req,res,next)=>upload.single('image')(req,res,(err)=>{if(err)return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'A imagem deve ter até 5 MB.':'Envie uma imagem PNG, JPG ou WebP válida.'});next();}), (req,res)=>{if(!req.file)return res.status(400).json({error:'Selecione uma imagem.'});res.status(201).json({url:`/uploads/${req.establishmentId}/${req.file.filename}`});});

api.get('/public/:slug', (req,res)=>{
  res.set('Cache-Control', 'no-store');
  const establishment=db.prepare('SELECT id,slug,name,description,address,phone,logo_url,cover_url,primary_color,accent_color FROM establishments WHERE slug=? AND published=1').get(req.params.slug); if(!establishment)return res.status(404).json({error:'Este cardápio não está disponível.'});
  const categories=db.prepare('SELECT id,name,description,sort_order FROM categories WHERE establishment_id=? AND active=1 ORDER BY sort_order,name').all(establishment.id);
  const products=db.prepare('SELECT id,category_id,name,description,price,promotional_price,image_url,available,featured FROM products WHERE establishment_id=? ORDER BY featured DESC,name').all(establishment.id);
  res.json({establishment,categories,products});
});

