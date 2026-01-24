# Use official Node.js LTS image
FROM node:25.4.0-trixie-slim

RUN apt-get update -y && \
	apt-get install -y --no-install-recommends \
		ca-certificates \
		curl \
		openssl \
		git

COPY --from=docker:dind /usr/local/bin/docker /usr/local/bin/

# Install Docker Compose v2 CLI plugin
RUN mkdir -p /usr/local/lib/docker/cli-plugins && \
	curl -SL https://github.com/docker/compose/releases/download/v5.0.2/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose && \
	chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

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