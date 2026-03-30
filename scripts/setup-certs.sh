#!/bin/bash
set -e

echo "🔐 Generating shared dev certificates for alice, bob, charlie..."

mkdir -p certs
mkcert -key-file certs/dev-key.pem -cert-file certs/dev-cert.pem alice bob charlie localhost

echo "✅ Created certs/dev-cert.pem and certs/dev-key.pem"
echo ""
echo "Run the following to trust the root CA in Node.js:"
echo "  export NODE_EXTRA_CA_CERTS=\"\$(mkcert -CAROOT)/rootCA.pem\""
echo ""
echo "Optional (browser/system trust, may prompt for sudo):"
echo "  mkcert -install"
