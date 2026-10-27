import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

export async function createAdminAccount({ name, email, password }, db) {
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanName.length < 2 || !/^\S+@\S+\.\S+$/.test(cleanEmail) || String(password || '').length < 12) {
    throw new Error('Confira nome, e-mail e senha (mínimo de 12 caracteres).');
  }
  if (db.prepare('SELECT id FROM users WHERE email=?').get(cleanEmail)) throw new Error('Já existe uma conta com este e-mail.');
  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare('INSERT INTO users (id,email,password_hash,name,role) VALUES (?,?,?,?,?)').run(randomUUID(), cleanEmail, passwordHash, cleanName, 'platform_admin');
  return { name: cleanName, email: cleanEmail };
}
