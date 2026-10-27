import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { db } from '../database/index.js';
import { createAdminAccount } from '../services/admin.js';

const rl=readline.createInterface({input,output});
try {
  const name=await rl.question('Nome do administrador: ');
  const email=await rl.question('E-mail: ');
  const password=await rl.question('Senha (mínimo 12 caracteres): ');
  const account=await createAdminAccount({name,email,password},db);
  console.log(`Administrador criado para ${account.email}.`);
} catch(error) { console.error(error.message); process.exitCode=1; } finally { rl.close(); }
