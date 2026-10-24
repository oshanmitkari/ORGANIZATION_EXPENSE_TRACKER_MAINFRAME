# Node.js web app + GnuCOBOL compiler, so the browser can trigger real COBOL runs without a local install.
#   docker build -t expense-cobol .
#   docker run -p 3000:3000 expense-cobol
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gnucobol && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN rm -rf bin && node scripts/build-cobol.js
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
