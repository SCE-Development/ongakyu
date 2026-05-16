#get nodejs 20 linux image
FROM node:20-slim
# set workdir in container to app
WORKDIR /app

# install yt-dlp
RUN apt-get update && apt-get install -y curl python3 && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# copy npm package list to workdir
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# get all npm packages and set to port 3001
RUN npm install

COPY prisma ./prisma

# generate prisma client
RUN npx prisma generate

COPY backend ./backend

# compile TypeScript
RUN npm --workspace backend run build

EXPOSE 3001

# start backend
CMD ["npm", "--workspace", "backend", "run", "start"]
