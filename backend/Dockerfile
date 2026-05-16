#get nodejs 20 linux image
FROM node:20-slim
# set workdir in container to app
WORKDIR /app

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
