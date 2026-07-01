FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 4000

CMD ["sh", "-c", "npm run db:ensure && npm start"]
