# Say Hueque — Plataforma de Alojamiento

Sistema interno para gestionar el listado de hoteles precotizados, prioridades por destino y pedidos de disponibilidad.

## Stack
- **Next.js 14** (App Router + TypeScript)
- **Supabase** (PostgreSQL + Auth + RLS)
- **Gmail API** (OAuth2) para mails transaccionales
- **Vercel** para deploy
- **GitHub Actions** para CI/CD

---

## Setup inicial

### 1. Clonar y preparar

```bash
git clone https://github.com/sayhueque/alojamiento.git
cd alojamiento
npm install
cp .env.example .env.local
```

### 2. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → New project
2. Nombre: `say-hueque-prod` | Región: **South America (São Paulo)**
3. Ir a Project Settings → API → copiar:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`
4. Ir a Project Settings → Database → Connection string → copiar URL completa → `SUPABASE_DB_URL`

### 3. Aplicar migraciones

```bash
npm install -g supabase
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

Opcional: cargar datos iniciales del Excel:
```bash
psql "$SUPABASE_DB_URL" < supabase/seed/001_seed.sql
```

### 4. Configurar Gmail API (OAuth2)

Esta es la parte más importante para los mails. Seguir estos pasos:

**4.1 — Crear proyecto en Google Cloud**
1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear proyecto nuevo: "Say Hueque Mails"
3. Ir a **APIs & Services** → **Enable APIs** → buscar "Gmail API" → habilitar

**4.2 — Crear credenciales OAuth2**
1. Ir a **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth Client ID**
2. Tipo: **Web application**
3. Nombre: "Say Hueque Mails"
4. Authorized redirect URIs: agregar `https://developers.google.com/oauthplayground`
5. Copiar `Client ID` → `GMAIL_CLIENT_ID`
6. Copiar `Client Secret` → `GMAIL_CLIENT_SECRET`

**4.3 — Obtener Refresh Token**
1. Ir a [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
2. Click en ⚙️ (settings arriba a la derecha)
3. Tildar **"Use your own OAuth credentials"**
4. Pegar `Client ID` y `Client Secret`
5. En la lista de la izquierda buscar **Gmail API v1** → seleccionar `https://mail.google.com/`
6. Click **Authorize APIs** → loguear con `reservas@sayhueque.com`
7. Click **Exchange authorization code for tokens**
8. Copiar `Refresh token` → `GMAIL_REFRESH_TOKEN`

**4.4 — Completar variables de entorno**
```env
GMAIL_CLIENT_ID=xxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxx
GMAIL_REFRESH_TOKEN=1//xxxx
GMAIL_FROM_EMAIL=reservas@sayhueque.com
GMAIL_FROM_NAME=Say Hueque
```

### 5. Conectar Vercel

1. Ir a [vercel.com](https://vercel.com) → New Project → importar repo de GitHub
2. Framework: Next.js (detecta automáticamente)
3. Agregar todas las variables del `.env.local` en Vercel → Environment Variables
4. Deploy

### 6. Secrets en GitHub Actions

En el repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Dónde conseguirlo |
|--------|-------------------|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
| `SUPABASE_DB_URL` | Supabase → Project Settings → Database → Connection string |
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens |

---

## Flujo de disponibilidad

```
Operador completa formulario en la plataforma
  └─▶ POST /api/availability
        ├─ Guarda en DB con status: "pending"
        ├─ Genera confirm_token y decline_token (automático en DB)
        └─ Envía mail al hotel desde reservas@sayhueque.com

Hotel recibe mail con dos botones:
  ├─ Click "Disponible"     → GET /api/availability/confirm?token=xxx
  └─ Click "No disponible"  → GET /api/availability/decline?token=xxx

Cualquiera de los dos:
  ├─ Valida token (no expirado, status=pending)
  ├─ Actualiza status en DB
  ├─ Envía mail al operador con el resultado
  └─ Muestra página de confirmación al hotel
```

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/login/           → Login con Supabase Auth
│   ├── (dashboard)/            → App principal (requiere auth)
│   │   ├── page.tsx            → Listado de hoteles
│   │   ├── hoteles/nuevo/      → Agregar hotel
│   │   ├── hoteles/[id]/       → Detalle + pedido de disponibilidad
│   │   └── disponibilidad/     → Historial de pedidos
│   └── api/
│       ├── availability/       → POST crear pedido
│       ├── availability/confirm/ → GET confirmar (hotel)
│       └── availability/decline/ → GET declinar (hotel)
├── lib/
│   ├── supabase/client.ts      → Cliente browser
│   ├── supabase/server.ts      → Cliente server + admin
│   ├── gmail/client.ts         → Gmail API OAuth2
│   └── emails/availability.ts  → Templates HTML de mails
└── types/database.ts           → Tipos generados por Supabase
```

## Comandos útiles

```bash
# Desarrollo local
npm run dev

# Regenerar tipos de Supabase tras cambios en DB
npm run db:types

# Aplicar nuevas migraciones
npm run db:push

# Type check
npm run type-check
```
