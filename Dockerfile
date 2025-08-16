FROM node:22.17.1-alpine3.21
RUN addgroup -S app && adduser -S app -G app -s /bin/false -D

ARG VITE_API_URL
ARG VITE_API_WS

WORKDIR /app

COPY --chown=app:app client/package*.json ./client/
COPY --chown=app:app server/package*.json ./server/

RUN cd client && npm ci --silent --ignore-scripts --prefer-offline
RUN cd server && npm ci --omit=dev --silent --ignore-scripts --prefer-offline

COPY --chown=app:app client/ ./client/
COPY --chown=app:app server/ ./server/

ENV VITE_API_URL=${VITE_API_URL:-https://ine-auction.onrender.com/api}
ENV VITE_API_WS=${VITE_API_WS:-https://ine-auction.onrender.com}

RUN cd client && npm run build

RUN mv client/dist server/public

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app/server

USER app

EXPOSE 8080

CMD ["node", "app.js"]
