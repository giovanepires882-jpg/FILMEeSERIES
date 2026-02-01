# VOD Streaming Platform

Plataforma de streaming completa com autenticação, pagamento PIX via Mercado Pago e catálogo sincronizado via M3U.

## 🚀 Features

- ✅ Autenticação JWT com cookies httpOnly
- ✅ Sistema de assinatura de 30 dias
- ✅ Pagamento PIX com Mercado Pago (webhook automático)
- ✅ Sincronização automática de playlist M3U
- ✅ Player HLS com hls.js
- ✅ Continue assistindo
- ✅ Favoritos
- ✅ Busca de conteúdos
- ✅ Interface estilo Netflix (dark theme, carroséis, hero banner)
- ✅ Admin dashboard
- ✅ Gating de conteúdo (apenas assinantes ativos)

## 🛠️ Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT (access + refresh tokens)
- **Payment**: Mercado Pago (PIX)
- **Player**: HTML5 + hls.js

## 🔑 Variáveis de Ambiente

Configure as seguintes variáveis no arquivo `.env`:

```env
# Database (SQLite - para produ\u00e7\u00e3o use PostgreSQL)
DATABASE_URL=file:./dev.db

# App
APP_BASE_URL=https://streamflix-3916.preview.emergentagent.com
NEXT_PUBLIC_APP_URL=https://streamflix-3916.preview.emergentagent.com

# JWT
JWT_SECRET=super-secret-jwt-key-change-in-production-32chars-min
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# Mercado Pago (PRODUÇÃO)
MP_ACCESS_TOKEN=seu_access_token_aqui
MP_PUBLIC_KEY=sua_public_key_aqui
MP_WEBHOOK_SECRET=sua_webhook_secret_aqui
MP_ENV=prod

# Subscription
SUBSCRIPTION_PRICE=15.00
SUBSCRIPTION_DAYS=30

# M3U Playlist (NUNCA expor no frontend)
M3U_URL=http://sua-playlist.m3u

# Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=senha_forte

# Cron (opcional)
CRON_SCHEDULE=0 3 * * *
```

## 💻 Instalação

1. **Instalar dependências**:
```bash
yarn install
```

2. **Configurar banco de dados**:
```bash
# O PostgreSQL já está instalado e rodando
# Gerar Prisma Client
npx prisma generate

# Criar tabelas
npx prisma db push

# Seed inicial (criar admin)
node prisma/seed.js
```

3. **Iniciar servidor**:
```bash
yarn dev
```

O app estará rodando em `http://localhost:3000`

## 🔗 Configuração do Webhook Mercado Pago

### URL do Webhook
```
https://streamflix-3916.preview.emergentagent.com/api/webhooks/mercadopago
```

### Configurar no Painel do Mercado Pago

1. Acesse: https://www.mercadopago.com.br/developers/panel/app
2. Selecione sua aplicação
3. Vá em "Webhooks" > "Configurar Webhooks"
4. Adicione a URL acima
5. Marque apenas o evento: **"Pagamentos"**
6. Configure a chave secreta (`MP_WEBHOOK_SECRET`) no .env
7. Salve

### Validação de Assinatura

O webhook valida a assinatura HMAC SHA256 automaticamente usando:
- `x-signature` header
- `x-request-id` header
- `MP_WEBHOOK_SECRET`

### Eventos de Teste

Eventos com `type: "test"` ou `action: "test.*"` são registrados mas **não ativam assinatura**.

## 📝 Fluxo de Pagamento PIX

1. **Usuário cria checkout**: `POST /api/billing/pix/checkout`
   - Gera QR Code PIX no Mercado Pago
   - Salva pagamento com status `PENDING`
   - Retorna QR Code base64 e código copia-e-cola

2. **Usuário paga via PIX**:
   - Escaneia QR Code ou cola código
   - Realiza pagamento no app do banco

3. **Mercado Pago envia webhook**: `POST /api/webhooks/mercadopago`
   - Valida assinatura HMAC
   - Verifica idempotência (evento já processado?)
   - Consulta status do pagamento na API do MP
   - Atualiza payment no DB
   - Se `status = approved`: **Ativa assinatura por 30 dias**
   - Se `status = refunded/chargeback`: **Suspende assinatura**

4. **Frontend faz polling**: `GET /api/billing/status?mpPaymentId=xxx`
   - Verifica status a cada 3 segundos
   - Quando aprovado, redireciona para home

## 📺 Sincronização M3U

### Manual (Admin Dashboard)

1. Login como admin (`giovanepires17@hotmail.com` / `admin123`)
2. Acesse `/admin`
3. Clique em "Sincronizar Agora"

### Automática (Cron)

Se o ambiente suportar cron, configure um job para chamar:
```bash
curl -X POST https://streamflix-3916.preview.emergentagent.com/api/admin/playlist/sync \
  -H "Cookie: accessToken=<seu_token_admin>"
```

### O que a sincronização faz?

1. Baixa playlist M3U da `M3U_URL`
2. Faz parsing dos itens (#EXTINF + URL)
3. Extrai: título, categoria, poster, stream URL
4. Gera `externalId` (tvg-id ou hash)
5. Faz upsert de categorias e VODs
6. Inativa VODs que sumiram da playlist (não deleta)
7. Registra log de sincronização

## 🔒 Segurança

### Autenticação
- JWT access token (15 min) + refresh token (30 dias)
- Refresh tokens hasheados no DB
- Rotação de tokens no refresh
- Cookies httpOnly e secure
- Rate limiting recomendado em produção

### Gating de Conteúdo
- Endpoint `/api/stream/[vodId]` **não retorna URL** se assinatura inativa
- Stream URLs **nunca expostas** no HTML/catálogo
- Validação server-side em todas as rotas de stream

### M3U URL
- **NUNCA** enviar `M3U_URL` para o frontend
- Apenas admin pode sincronizar
- Logs não devem expor URLs de stream

## 🎭 Endpoints da API

### Auth
- `POST /api/auth/register` - Criar conta
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Renovar token
- `POST /api/auth/logout` - Logout
- `GET /api/me` - Dados do usuário logado

### Catálogo
- `GET /api/categories` - Listar categorias
- `GET /api/vods?q=&category=&page=` - Listar VODs
- `GET /api/vods/[id]` - Detalhes de um VOD

### Stream (requer assinatura ativa)
- `GET /api/stream/[vodId]` - Obter URL do stream

### Progress
- `GET /api/progress` - Listar progresso do usuário
- `POST /api/progress/[vodId]` - Salvar progresso

### Favoritos
- `GET /api/favorites` - Listar favoritos
- `POST /api/favorites/[vodId]` - Adicionar favorito
- `DELETE /api/favorites/[vodId]` - Remover favorito

### Billing
- `POST /api/billing/pix/checkout` - Criar pagamento PIX
- `GET /api/billing/status?mpPaymentId=` - Status do pagamento
- `GET /api/billing/payments` - Histórico de pagamentos

### Webhook
- `POST /api/webhooks/mercadopago` - Receber eventos do MP

### Admin (requer role ADMIN)
- `POST /api/admin/playlist/sync` - Sincronizar M3U
- `GET /api/admin/sync/logs` - Logs de sincronização
- `GET /api/admin/users` - Listar usuários
- `POST /api/admin/vod/toggle` - Ativar/desativar VOD

### Health
- `GET /api/health` - Status da aplicação
- `GET /api/ready` - Status do banco de dados

## 💳 Teste Real do Fluxo PIX

1. Criar conta de usuário
2. Acessar `/checkout/pix`
3. Gerar QR Code
4. Pagar via PIX no app do banco
5. Webhook recebe `payment.updated`
6. Assinatura vira `ACTIVE` + `endAt` = agora + 30 dias
7. Frontend detecta aprovação e redireciona
8. Usuário pode assistir conteúdos

## ⚠️ Importante

### Simular Notificação no Painel MP
- **NÃO ativa assinatura** (evento de teste)
- Use pagamento PIX real para testar

### URLs em Produção
- Configure `APP_BASE_URL` com a URL pública do deploy
- O webhook usará essa URL automaticamente
- **Não use ngrok** - use a URL nativa do Emergent

### Cron
- Se o ambiente não suporta node-cron, agende manualmente via cron do sistema ou serviço externo

## 📦 Estrutura do Projeto

```
/app
├── app/
│   ├── api/[[...path]]/route.js  # API backend
│   ├── page.js                   # Home
│   ├── login/page.js             # Login/Register
│   ├── title/[id]/page.js        # Detalhes do VOD
│   ├── watch/[id]/page.js        # Player
│   ├── account/page.js           # Minha conta
│   ├── checkout/pix/page.js      # Checkout PIX
│   ├── search/page.js            # Busca
│   └── admin/page.js             # Admin dashboard
├── components/
│   ├── vod-carousel.js
│   ├── continue-watching.js
│   └── ui/                       # shadcn components
├── lib/
│   ├── prisma.js                 # Prisma client
│   ├── auth.js                   # Auth helpers
│   ├── subscription.js           # Subscription logic
│   ├── mercadopago.js            # MP integration
│   └── m3u-parser.js             # M3U parser
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── seed.js                   # Seed script
├── .env
├── package.json
└── README.md
```

## 👥 Credenciais Padrão

**Admin**:
- Email: `giovanepires17@hotmail.com`
- Senha: `admin123`

## 📚 Próximos Passos

1. Configurar webhook no painel do Mercado Pago
2. Realizar primeiro pagamento PIX de teste
3. Sincronizar playlist M3U via admin
4. Assistir conteúdo!

## 🐛 Troubleshooting

### Webhook não está funcionando
- Verifique se `APP_BASE_URL` está correto
- Confira se `MP_WEBHOOK_SECRET` é o mesmo configurado no painel
- Veja logs do webhook: `tail -f /var/log/supervisor/nextjs.out.log`

### Assinatura não ativa após pagamento
- Verifique se o webhook foi recebido (tabela `WebhookEvent`)
- Confirme se o pagamento foi aprovado no painel do MP
- Veja se há erros nos logs

### VODs não aparecem
- Execute sincronização manual no admin
- Verifique se `M3U_URL` está acessível
- Confira logs de sincronização no admin

---

**Desenvolvido com ❤️ usando Next.js + Prisma + Mercado Pago**