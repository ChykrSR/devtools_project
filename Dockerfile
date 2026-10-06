# Stage 1: Build dependencies
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# คัดลอกเฉพาะไฟล์ที่ต้องใช้จริง
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

# กำหนด Non-root user เพื่อความปลอดภัย
USER node
EXPOSE 3000

CMD ["node", "dist/main.js"]