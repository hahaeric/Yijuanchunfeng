FROM node:24-alpine
WORKDIR /app
COPY server/index.mjs ./server/index.mjs
RUN mkdir /data && chown node:node /data
USER node
WORKDIR /data
ENV PORT=8787
EXPOSE 8787
CMD ["node", "/app/server/index.mjs"]
