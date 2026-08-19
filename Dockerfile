# Railway build untuk SchoolDMS backend (NestJS + Prisma).
# Dipanggil dari root repo; salin & bina dalam folder backend/.
FROM node:20-slim

# Prisma memerlukan openssl
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Salin dahulu untuk cache layer
COPY backend/package*.json ./
RUN npm install

# Salin sumber backend + prisma
COPY backend/ ./

# Generate Prisma Client + build NestJS
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
