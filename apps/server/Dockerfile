# Production image for @squidbox/server. Build context = repo ROOT (needs packages/shared).
# The server runs its TypeScript directly via tsx (a runtime dependency) — no build step.
#
# We install ONLY the server's own dependencies (not the whole workspace — that would drag in the
# mobile app's Expo/React Native deps and make the build huge and slow). @squidbox/shared is pure
# TS consumed via tsx, so we vendor it as source into node_modules instead of installing it.
FROM node:20-slim
WORKDIR /app/apps/server
ENV NODE_ENV=production

# Install the server's prod deps only. Drop the workspace-only @squidbox/shared dep first (it's
# vendored below), and skip install scripts (no native builds).
COPY apps/server/package.json ./
RUN npm pkg delete dependencies.@squidbox/shared \
  && npm install --omit=dev --ignore-scripts --no-audit --no-fund

# Server source + the shared contracts, vendored so `import '@squidbox/shared'` resolves.
COPY apps/server/ ./
COPY packages/shared/ ./node_modules/@squidbox/shared/

EXPOSE 3100
# PORT/HOST/secrets come from the environment (Fly secrets); config.ts reads process.env.
CMD ["node", "--import", "tsx", "src/index.ts"]
