FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["npm", "run", "video:worker"]
