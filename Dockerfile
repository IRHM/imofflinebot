# Run stage
FROM node:20 as runner

# Create app dir
WORKDIR /app

COPY ["./package.json", "./package-lock.json", "./"]

RUN npm ci --only=production

COPY ./index.js ./

VOLUME /app/data

CMD [ "node", "index.js" ]
