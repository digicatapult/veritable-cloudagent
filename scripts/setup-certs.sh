#!/bin/bash
set -e

echo "🔐 Generating shared dev certificates for alice, bob, charlie..."

if ! command -v mkcert >/dev/null 2>&1; then
  echo "❌ mkcert is not installed or not on your PATH."
  echo ""
  echo "This script requires mkcert to generate local development TLS certificates."
  echo "Install mkcert and re-run this script. Examples:"
  echo "  macOS (Homebrew):  brew install mkcert"
  echo "  Linux (amd64):     curl -JLO \"https://dl.filippo.io/mkcert/latest?for=linux/amd64\" && \\"
  echo "                      chmod +x mkcert-* && sudo mv mkcert-* /usr/local/bin/mkcert"
  echo ""
  echo "See https://github.com/FiloSottile/mkcert for installation instructions."
  exit 1
fi
mkdir -p certs
mkcert -key-file certs/dev-key.pem -cert-file certs/dev-cert.pem alice bob charlie localhost

echo "✅ Created certs/dev-cert.pem and certs/dev-key.pem"
echo ""
echo "Run the following to trust the root CA in Node.js:"
echo "  export NODE_EXTRA_CA_CERTS=\"\$(mkcert -CAROOT)/rootCA.pem\""
echo ""
echo "Optional (browser/system trust, may prompt for sudo):"
echo "  mkcert -install"
