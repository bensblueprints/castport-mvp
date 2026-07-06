FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
ENV PORT=5329
ENV DATA_DIR=/data
ENV BASE_URL=http://localhost:5329
VOLUME /data
EXPOSE 5329
CMD ["node", "server/index.js"]
