FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/contracts packages/contracts
COPY packages/domain packages/domain
RUN pnpm --filter @campflow/contracts build \
    && pnpm --filter @campflow/domain build \
    && pnpm --filter @campflow/api prisma:generate \
    && pnpm --filter @campflow/api build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S campflow && adduser -S -G campflow campflow
COPY --from=build --chown=campflow:campflow /app /app
RUN mkdir -p /app/storage-data && chown -R campflow:campflow /app/storage-data
USER campflow
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
