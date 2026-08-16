FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY src/ ./src/
ENV NODE_ENV=production
EXPOSE 9000
CMD ["node", "src/index.js"]
