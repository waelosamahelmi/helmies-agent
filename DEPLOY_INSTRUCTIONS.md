# Deployment Instructions for Helmies Studio

## 1. Copy Configuration Files to Server

Since the configuration files are gitignored, they need to be manually transferred to the server:

### Option A: Using SCP from your local machine (recommended)
```bash
# Copy librechat.yaml
scp -i ~/.ssh/id_rsa "/c/Users/Wael Helmi/Documents/Default Project/LibreChat-helmies/librechat.yaml" root@69.62.126.13:/var/www/helmies-agent/librechat.yaml

# Copy .env file  
scp -i ~/.ssh/id_rsa "/c/Users/Wael Helmi/Documents/Default Project/LibreChat-helmies/.env" root@69.62.126.13:/var/www/helmies-agent/.env
```

### Option B: Manual copy on server
If you have access to the files locally, you can also manually create them on the server:
```bash
# On the server, create the files with the correct content
cat > /var/www/helmies-agent/librechat.yaml << 'EOF'
# Paste the content from your local librechat.yaml file here
EOF

cat > /var/www/helmies-agent/.env << 'EOF'
# Paste the content from your local .env file here
EOF
```

## 2. Rebuild and Restart Docker

Once the files are copied, rebuild and restart the application:

```bash
cd /var/www/helmies-agent/
docker compose build --no-cache api
docker compose up -d
```

## 3. Verify Deployment

Check that everything is running properly:

```bash
docker ps
# Should show helmies-studio-api, helmies-studio-mongodb, and helmies-studio-meilisearch containers

docker logs helmies-studio-api
# Should show successful startup without errors
```

## Expected Results After Deployment:

- ✅ Users see only model names (no endpoint names like "OpenRouter", "KIE")
- ✅ All admin features hidden from regular users
- ✅ No more "user can add API key" prompt
- ✅ Properly configured KIE and OpenRouter endpoints
- ✅ Inter font applied throughout the UI
- ✅ All "LibreChat" text changed to "Helmies Studio"
- ✅ Help/FAQ URL points to https://studio.helmies.fi