# FinSightAI — Frontend

Interfaz web de **FinSightAI**, la app de salud financiera personal del **Team 29** (No-Country G9).

## 🧰 Stack
- **React + Vite + TypeScript**
- **Tailwind CSS**
- **Supabase** (auth + sesión) · **Groq/Gemini** (asistente IA "Finsi")

## ▶️ Correr en local
```bash
npm install
npm run dev        # http://localhost:5173
```
Requiere un `.env` con: `VITE_API_URL`, `VITE_AI_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## 📦 Build de producción
```bash
npm run build      # genera dist/
```

## 🐳 Docker
```bash
docker build -t finsightai-frontend .   # build (Vite) → servido con nginx
```

## ✨ Funcionalidades
Dashboard financiero · Transacciones (con paginación e importación CSV) · Análisis de perfil (ML) ·
Recomendaciones · Metas de ahorro · Asistente IA "Finsi" · Perfil.

---

> La base de la plantilla de UI se apoyó en TailAdmin (React + Tailwind, MIT). El producto,
> las funcionalidades y la integración con el backend/IA son del Team 29.
