# Use official Node.js LTS image
FROM node:25.4.0-trixie-slim

RUN apt-get update -y && \
	apt-get install -y --no-install-recommends \
		ca-certificates \
		curl \
		openssl \
		git \
		docker.io \
	rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json & package-lock.json
COPY package*.json ./
COPY pnpm-lock.yaml ./

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy app code
COPY . .

# Expose port
EXPOSE 3000

# Start the app
CMD ["pnpm", "start"]