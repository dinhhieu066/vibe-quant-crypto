FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Expose default port (Hugging Face uses 7860, Render uses 10000, local uses 3000)
ENV PORT=7860
EXPOSE 7860

CMD ["node", "src/server.js"]
