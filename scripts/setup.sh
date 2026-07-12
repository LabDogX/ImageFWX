#!/usr/bin/env sh
set -eu

if [ -e .env ]; then
    echo ".env already exists; it was not changed. Edit it directly if needed."
    exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl is required to generate deployment secrets." >&2
    exit 1
fi

cp .env.example .env

secret_key=$(openssl rand -hex 32)
jwt_secret=$(openssl rand -hex 32)
postgres_password=$(openssl rand -hex 24)

sed -i.bak "s|^SECRET_KEY=.*|SECRET_KEY=${secret_key}|" .env
sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" .env
sed -i.bak "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${postgres_password}|" .env
sed -i.bak "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://localhost:3012|" .env
sed -i.bak "s|^ALLOW_REGISTRATION=.*|ALLOW_REGISTRATION=true|" .env
rm -f .env.bak

echo "Created .env with generated secrets."
echo "Registration is enabled for the first account. Set ALLOW_REGISTRATION=false afterwards."
echo "For a public domain, set ALLOWED_ORIGINS to its HTTPS origin before starting."
