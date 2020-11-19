FROM node:14
WORKDIR /usr/src/app

COPY . .

RUN npm install

EXPOSE 8080 3000 30001

RUN npm install

CMD npx gulp watch

