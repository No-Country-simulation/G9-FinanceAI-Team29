# --- Etapa 1: build del frontend (Vite) ---
FROM node:20-alpine AS build
WORKDIR /app

# Instalar dependencias (capa cacheada mientras no cambie package*.json)
COPY package.json package-lock.json ./
RUN npm ci

# Copiar el resto y buildear. Vite lee los .env presentes en el contexto
# (para OCI usar frontend/.env.production con VITE_API_URL=/api y VITE_AI_URL=/ai).
COPY . .
RUN npm run build

# --- Etapa 2: servir el build estático con nginx ---
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
