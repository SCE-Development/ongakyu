#get nodejs 20 linux image
FROM node:20-slim
# set workdir in container to app
WORKDIR /app 

# copy npm package list to workdir
COPY package.json package-lock.json ./
copy backend/package.json ./backend/


RUN npm install 
COPY backend ./package
COPY prism ./prisma
# get all npm packages and set to port 3000
EXPOSE 3000

CMD {"npm","--workspace","backend", "run", "start"} # start backend
