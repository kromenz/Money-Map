import fs from 'fs';
import path from 'path';
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const port: number = Number(process.env.PORT) || 5000;

try {
  const pgUser = fs.readFileSync(path.join('/run/secrets', 'pg_user'), 'utf8').trim();
  const pgPassword = fs.readFileSync(path.join('/run/secrets', 'pg_password'), 'utf8').trim();
  process.env.DATABASE_URL = `postgresql://${pgUser}:${pgPassword}@db:5432/moneymap`;
  console.log('DATABASE_URL definida via Docker Secrets:', process.env.DATABASE_URL);
} catch (error) {
  console.error('Erro ao ler os Docker Secrets. Utilizando fallback.', error);
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@db:5432/moneymap';
  console.log('Usando DATABASE_URL padrão:', process.env.DATABASE_URL);
}

const prisma = new PrismaClient();

app.use(express.json());

app.get('/', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany();
    res.json({ message: 'API funcionando!', users });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
