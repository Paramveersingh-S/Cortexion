FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY src/ ./src/
ENV NODE_ENV=production
EXPOSE 3001 8081
CMD ["node", "src/server.js"]
