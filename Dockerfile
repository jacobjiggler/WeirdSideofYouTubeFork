FROM node:18-alpine

WORKDIR /app

# Install deps first (layer cache friendly — only re-runs if package.json changes)
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the source
COPY . .

EXPOSE 3000

# npm start runs webpack then boots the server
CMD ["npm", "start"]
