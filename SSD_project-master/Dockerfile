# syntax=docker/dockerfile:1.7
#
# Shield-Chat — single-image build.
# Multi-stage build produces a small production image that serves both the
# API (Express + Socket.io) and the React SPA from the same origin on :5000.
#
# Build:  docker build -t shield-chat .
# Run:    docker run --rm -p 5000:5000 --env-file backend/.env shield-chat
# Or just: docker compose up -d

# -------- Stage 1: build frontend bundle --------
FROM node:20-alpine AS frontend-build
WORKDIR /frontend

# Create React App + React 18 has transitive peer-dep conflicts that `npm
# install` auto-resolves via legacy peer deps locally. `npm ci` under Node 20
# is strict by default and fails on them — opt back into the legacy resolver
# for this stage only so the build matches what the developer has locally.
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true

# install deps first so docker can cache this layer when only source changes
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

# bring in the rest of the frontend sources and build
COPY frontend/tsconfig.json ./
COPY frontend/public ./public
COPY frontend/src ./src
# Build flags:
#   CI=false                   — don't treat ESLint warnings as errors
#   INLINE_RUNTIME_CHUNK=false — emit runtime chunk as an external file
#                                so the SPA has no inline <script> that
#                                would need a CSP nonce at build time.
#   GENERATE_SOURCEMAP=false   — don't ship source maps in prod (ZAP alert
#                                "Source Code Disclosure" + smaller bundle).
RUN CI=false INLINE_RUNTIME_CHUNK=false GENERATE_SOURCEMAP=false npm run build


# -------- Stage 2: compile backend TypeScript --------
FROM node:20-alpine AS backend-build
WORKDIR /backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build


# -------- Stage 3: production runtime --------
FROM node:20-alpine AS runtime

# install only prod deps for the backend
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

# copy compiled output from the two build stages
COPY --from=backend-build  /backend/dist                /app/backend/dist
COPY --from=frontend-build /frontend/build              /app/frontend/build

# defaults — override via --env-file or compose
ENV NODE_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0

# drop privileges
RUN addgroup -S app && adduser -S -G app app \
  && chown -R app:app /app
USER app

EXPOSE 5000

# busybox wget is shipped with alpine; used by compose healthcheck too
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:5000/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "dist/server.js"]
