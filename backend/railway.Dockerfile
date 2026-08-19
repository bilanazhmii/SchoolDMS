# Railway build untuk backend SchoolDMS (NestJS + Prisma)
# Dockerfile di namakan railway.Dockerfile supaya tidak mengganggu vercel.json (web).
FROM node:22-slim

# Prisma memerlukan openssl
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Salin package dahulu untuk cache layer
COPY package*.json ./
RUN npm install

# Salin sumber + prisma
COPY . .

# Generate Prisma Client + build NestJS
RUN npx prisma generate
RUN npm run build

# Prisma CLI diperlukan oleh start command (migrate deploy)
RUN npx prisma --version

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "scripts/start-production.sh"]
