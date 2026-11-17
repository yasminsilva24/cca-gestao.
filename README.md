# CCA Gestão

Aplicação inicial em React + Vite + Supabase.

## Configuração local
1. Instale Node.js (versão LTS).
2. Copie `.env.example` para `.env.local`.
3. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a Publishable key do projeto.
4. Execute `npm install` e `npm run dev`.

## Publicação na Vercel
Importe este repositório na Vercel e configure as variáveis:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Nunca coloque chaves `secret` ou `service_role` no navegador.