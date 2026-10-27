import jwt from 'jsonwebtoken';
import { db } from '../database/index.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.mesa_session;
  if (!token) return res.status(401).json({ error: 'Faça login para continuar.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.jti || !db.prepare('SELECT id FROM user_sessions WHERE id = ? AND expires_at > ?').get(payload.jti, Date.now())) {
      return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });
    }
    req.user = payload;
    return next();
  }
  catch { return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' }); }
}

export function requireEstablishment(req, res, next) {
  const establishmentId = req.get('x-establishment-id') || req.params.establishmentId || req.body?.establishmentId;
  if (req.user.role === 'platform_admin') return res.status(403).json({ error: 'O administrador da plataforma não acessa os dados internos dos clientes.' });
  if (!establishmentId) return res.status(400).json({ error: 'Selecione um estabelecimento.' });
  if (req.user.establishmentId !== establishmentId) {
    return res.status(403).json({ error: 'Acesso não autorizado a este estabelecimento.' });
  }
  req.establishmentId = establishmentId;
  next();
}

export function requirePlatformAdmin(req, res, next) {
  if (req.user?.role !== 'platform_admin') return res.status(403).json({ error: 'Acesso restrito.' });
  next();
}
