FROM node:22-alpine

WORKDIR /app

# Install deps first (layer cache friendly — only re-runs if package.json changes)
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the source
COPY . .

# Run as the built-in non-root 'node' user. Defense-in-depth: a compromised app
# doesn't get root in the container, nor root-level write access to the mounted
# source on the host. Pre-create dist/ so the anonymous volume mounted there
# (see docker-compose) inherits node ownership and webpack can write the bundle.
RUN mkdir -p /app/dist && chown -R node:node /app
USER node

EXPOSE 3000

# npm start runs webpack then boots the server
CMD ["npm", "start"]
