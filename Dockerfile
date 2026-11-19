# Usar una imagen de Node que incluya las librerías necesarias
FROM node:20-slim

# Instalar Chromium y dependencias del sistema necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Configurar variables de entorno para que Puppeteer use el Chromium del sistema
# y no intente descargar uno propio (lo que ahorra tiempo y evita errores)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Clave: instalar TODAS las dependencias (incluyendo devDependencies)
# Necesario porque Tailwind v4 usa @tailwindcss/postcss que está en devDependencies
# y jszip debe resolverse correctamente durante el build
RUN npm ci --include=dev

# Refuerzo explícito por si la caché de npm omite jszip
RUN npm install jszip --no-save

# Copiar el resto del código
COPY . .

# Establecer NODE_ENV=production DESPUÉS de instalar dependencias
# para que Next.js genere el build de producción correctamente
ENV NODE_ENV=production

# Construir la aplicación Next.js
RUN npm run build

# Exponer el puerto (Next.js por defecto usa 3000)
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
