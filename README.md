# Mesa Viva — Cardápios Digitais

MVP funcional para criar estabelecimentos, organizar categorias e produtos e publicar cardápios com identidade visual própria. O painel Mesa Viva tem marca independente da marca de cada restaurante.

## Requisitos e instalação

- Node.js 20 ou superior e npm.
- Na raiz, execute:

```powershell
npm install
npm --prefix backend install
npm --prefix frontend install
Copy-Item backend/.env.example backend/.env
```

Edite `backend/.env` e defina `JWT_SECRET` com uma chave aleatória de pelo menos 32 caracteres. Gere uma chave no PowerShell com `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.

Crie o primeiro administrador pelo assistente interativo (nome, e-mail e senha de pelo menos 12 caracteres):

```powershell
npm run create-admin
```

Inicie API e frontend juntos usando `npm run dev`. Acesse <http://localhost:5173>. Cadastre um estabelecimento, crie categorias e produtos, personalize o cardápio e publique. O endereço público usa o formato `http://localhost:5173/m/slug-do-estabelecimento`. Para iniciar separadamente, use `npm run dev:api` e `npm run dev:web`. API de saúde: `http://localhost:3001/api/health`.

## Incluído

- Login/logout com cookie HTTP only, JWT de duração limitada, hash bcrypt e limite de tentativas.
- CRUD de estabelecimentos, categorias e produtos, incluindo preços promocionais, disponibilidade, destaque e ordenação.
- Upload local por estabelecimento, até 5 MB, com tipos de imagem raster permitidos.
- Escopo por estabelecimento nas operações administrativas e cardápios públicos por slug sem login.
- Personalização de cores, logo e capa; QR Code e impressão; painel responsivo e identidade visual própria.
- PWA instalável, cache do app, cardápios públicos visitados e imagens. Dados administrativos não entram no cache.

## Verificacao

Execute `npm test` para um smoke test com SQLite e uploads temporarios. Ele verifica criacao de administrador, login/logout, permissoes entre estabelecimentos, CRUD, ordenacao, upload e cardapio publico. `npm run build` gera o frontend e o Service Worker.

## Dados e arquivos

SQLite é criado em `backend/data/mesa-viva.sqlite`, com foreign keys, índices e WAL. Imagens ficam em `backend/uploads/<id-do-estabelecimento>/`. Esses diretórios não são versionados. Faça backup do banco e das imagens em conjunto. Para cópia consistente do SQLite, use o mecanismo de backup do SQLite ou pare o backend antes de copiar.

## Build e produção

No `backend/.env`, configure `JWT_SECRET` exclusivo, `FRONTEND_ORIGIN` com a origem confiável do site, `COOKIE_SECURE=true` quando usar HTTPS, e ajuste `PORT`, `DB_PATH` e `UPLOAD_DIR` conforme necessário. Defina `VITE_API_URL` no ambiente do build do frontend para a URL HTTPS completa da API (por exemplo `https://api.seudominio.com/api`) e execute `npm run build`. Publique `frontend/dist` em um servidor web e inicie a API com `npm start` na raiz. Sirva frontend e API em HTTPS; PWA instalável exige HTTPS fora de localhost. Não use o servidor Vite em produção.

O cache offline armazena apenas rotas `/api/public/` visitadas e imagens. O cardápio usa Network First e poderá exibir a cópia salva sem internet. Cadastros administrativos não funcionam offline nem são sincronizados.

## Limitações

- A criação da conta inicial é feita pela CLI. Ainda não há cadastro público, recuperação de senha ou gestão de operadores.
- O armazenamento é um SQLite local e pasta de uploads local. Uma implantação com várias instâncias requer storage compartilhado e planejamento de migração.
- Pedidos, pagamentos, delivery, WhatsApp, relatórios avançados e assinaturas ficam fora deste MVP.
