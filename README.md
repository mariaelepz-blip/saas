# InstaHot

SaaS para gerenciar uma operação de conteúdo no Instagram: conexão de contas via login oficial da Meta, status em tempo real, esteira de aquecimento, agendamento de Feed/Reels/Stories e geração de variações de vídeo (espelhamento, filtros, cortes) para evitar conteúdo duplicado entre contas.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + PostgreSQL
- NextAuth (login por e-mail/senha da plataforma)
- Instagram Graph API (Meta) para conexão e publicação real das contas
- ffmpeg (via `fluent-ffmpeg`/`ffmpeg-static`) para o pipeline de variações de vídeo

## Por que não há "login com usuário e senha" do Instagram

A Meta não permite automação não-oficial (login via Selenium/bots, etc.) — isso viola os Termos de Uso e é o principal motivo de banimento de contas. Este projeto usa exclusivamente a **Instagram Graph API**, que exige:

- Conta do Instagram do tipo **Business ou Creator**;
- Vinculada a uma **Página do Facebook**;
- Autorização via **OAuth oficial** (Login do Facebook para Empresas).

O fluxo de "logar conta" no app é, na prática, o usuário autorizar o acesso pelo diálogo oficial da Meta — após isso o app passa a gerenciar a conta de forma legítima (publicar, ler métricas, etc.).

## Configuração

1. Crie um app em https://developers.facebook.com com os produtos **Facebook Login for Business** e **Instagram Graph API**.
2. Copie `.env.example` para `.env` e preencha:
   - `DATABASE_URL`: string de conexão Postgres
   - `NEXTAUTH_URL` / `NEXTAUTH_SECRET`
   - `META_APP_ID` / `META_APP_SECRET` / `META_REDIRECT_URI`
   - `TOKEN_ENCRYPTION_KEY`: gere com `openssl rand -base64 32`
   - `CRON_SECRET`: string aleatória usada para autenticar o worker de publicação
3. Rode as migrações:
   ```bash
   npx prisma migrate dev
   ```
4. Suba o projeto:
   ```bash
   npm run dev
   ```

## Worker de publicação

As publicações agendadas são processadas por `POST /api/scheduled-posts/publish`. Configure um cron job externo (Vercel Cron, GitHub Actions, etc.) para chamar esse endpoint a cada minuto com o header:

```
Authorization: Bearer <CRON_SECRET>
```

## Armazenamento de mídia

A Graph API exige que os arquivos de mídia estejam acessíveis por URL pública. Em desenvolvimento, os uploads ficam em `public/uploads`; em produção, troque por um bucket (S3, GCS, Cloudflare R2 etc.) e ajuste `src/app/api/media/route.ts`.

## Funcionalidades incluídas

- **Contas**: conectar via OAuth, ver status real (ativa, aquecendo, token expirado, requer atenção, desconectada), sincronizar métricas, desconectar.
- **Esteira de aquecimento**: plano com etapas progressivas de volume/frequência de publicação, dentro dos limites da Graph API.
- **Agendamento**: criação de posts de Feed, Reels, Stories e Carrossel com data/hora, legenda e hashtags; worker assíncrono publica via Graph API e tenta novamente em caso de falha.
- **Biblioteca de mídia + variações anti-duplicidade**: upload de vídeos/imagens e geração de variações com espelhamento (preservando regiões com texto embutido), filtros leves, corte de bordas, variação de velocidade e ruído sutil — tudo via ffmpeg no servidor.
- **Métricas**: snapshots de seguidores, alcance e impressões por conta.
- **Notificações/atividade**: log de eventos por conta (conexão, publicação, falhas, mudanças de status).

## Sugestões de próximos passos

- Painel de métricas com gráficos de evolução por conta.
- Biblioteca de legendas/hashtags reutilizáveis e geração assistida por IA.
- Fila de revisão antes da publicação (aprovação manual).
- Repositório de "ganchos"/roteiros para Reels com histórico de performance.
- Alertas via e-mail/WhatsApp para tokens expirando ou publicações com falha.
