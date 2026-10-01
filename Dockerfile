FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV CI=true
RUN npm install --global pnpm@10.11.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm test && pnpm build && pnpm prune --prod

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000 DATABASE_PATH=/app/data/ddak.sqlite
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
EXPOSE 10000
CMD ["node", "server/index.mjs"]
