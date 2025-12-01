#!/bin/bash

# ==============================================================================
# SCRIPT DE INICIALIZACIÓN "CERO FRICCIÓN" PARA PROCUREDATA V2
# ==============================================================================
# Propósito:
# 1. Esperar a que FIWARE (Docker) esté listo.
# 2. Configurar Keyrock (Crear App, Usuarios, Roles).
# 3. Generar archivo .env con credenciales para el desarrollador.
# 4. Inyectar datos de prueba (Gemelos Digitales) en Orion-LD.
# ==============================================================================

# Configuración Base (Debe coincidir con docker-compose.yml)
KEYROCK_HOST="http://localhost:3005"
ORION_HOST="http://localhost:1026" # Acceso directo para seed (bypaseando PEP para init)
ADMIN_EMAIL="admin@test.com"
ADMIN_PASS="1234"

echo "🚀 Iniciando configuración del entorno de desarrollo..."

# 1. Verificación de Dependencias
if ! command -v jq &> /dev/null; then
    echo "❌ Error: 'jq' no está instalado. Por favor instálalo (sudo apt install jq / brew install jq)"
    exit 1
fi

# 2. Esperar a que Keyrock esté vivo
echo "⏳ Esperando a que Keyrock ($KEYROCK_HOST) responda..."
until curl -s $KEYROCK_HOST/v1/auth/tokens > /dev/null; do
    printf '.'
    sleep 2
done
echo "✅ Keyrock está online."

# 3. Autenticación como Admin
echo "🔑 Obteniendo token de administrador..."
ADMIN_TOKEN=$(curl -s -X POST "$KEYROCK_HOST/v1/auth/tokens" \
  -H "Content-Type: application/json" \
  -d "{ \"name\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASS\" }" \
  | jq -r '.token.value')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ Fallo al autenticar. Revisa las credenciales en docker-compose."
    exit 1
fi

# 4. Crear Aplicación "PROCUREDATA Core" (Para obtener Client ID/Secret)
echo "📦 Registrando aplicación 'PROCUREDATA Core'..."
APP_RESPONSE=$(curl -s -X POST "$KEYROCK_HOST/v1/applications" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $ADMIN_TOKEN" \
  -d '{
    "application": {
      "name": "PROCUREDATA Core",
      "description": "App generada automáticamente para desarrollo",
      "redirect_uri": "http://localhost:3000/auth/callback",
      "url": "http://localhost:3000",
      "grant_type": ["authorization_code", "implicit", "password"]
    }
  }')

APP_ID=$(echo $APP_RESPONSE | jq -r '.application.id')
CLIENT_ID=$(echo $APP_RESPONSE | jq -r '.application.oauth_client_id')
CLIENT_SECRET=$(echo $APP_RESPONSE | jq -r '.application.oauth_client_secret')

if [ "$APP_ID" == "null" ]; then
    echo "❌ Error creando aplicación. Respuesta:"
    echo $APP_RESPONSE | jq
    exit 1
fi

# 5. Crear Usuario de Servicio (PEP Proxy User)
echo "👤 Creando usuario de servicio 'pep_user'..."
USER_RESPONSE=$(curl -s -X POST "$KEYROCK_HOST/v1/users" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $ADMIN_TOKEN" \
  -d '{
    "user": {
      "username": "pep_user",
      "email": "pep@procuredata.app",
      "password": "pep_password_123"
    }
  }')

PEP_USER_ID=$(echo $USER_RESPONSE | jq -r '.user.id')

# 6. Generar archivo .env para el desarrollador
echo "📝 Generando archivo '.env.dev' con las credenciales..."
cat > .env.dev <<EOF
# --- Credenciales Generadas Automáticamente ---
# Copia estos valores a tu Supabase Edge Function o PEP Proxy

IDM_HOST=$KEYROCK_HOST
FIWARE_APP_ID=$APP_ID
FIWARE_CLIENT_ID=$CLIENT_ID
FIWARE_CLIENT_SECRET=$CLIENT_SECRET

# Usuario para el Proxy
FIWARE_USER=$ADMIN_EMAIL
FIWARE_PASS=$ADMIN_PASS

# Usuario PEP Proxy
PEP_PROXY_USERNAME=pep_user
PEP_PROXY_PASSWORD=pep_password_123
PEP_USER_ID=$PEP_USER_ID
EOF

# 7. Esperar a que Orion-LD esté listo
echo "⏳ Esperando a que Orion-LD ($ORION_HOST) responda..."
until curl -s "$ORION_HOST/version" > /dev/null; do
    printf '.'
    sleep 2
done
echo "✅ Orion-LD está online."

# 8. Hidratación de Datos (Data Seeding) en Orion-LD
echo "🌱 Sembrando datos de prueba en Orion-LD..."

# Entidad 1: Vehículo de Logística
curl -s -X POST "$ORION_HOST/ngsi-ld/v1/entities/" \
  -H "Content-Type: application/ld+json" \
  -d '{
    "id": "urn:ngsi-ld:Vehicle:flota-001",
    "type": "Vehicle",
    "brandName": { "type": "Property", "value": "Volvo" },
    "speed": { "type": "Property", "value": 85 },
    "cargoWeight": { "type": "Property", "value": 1200 },
    "location": {
        "type": "GeoProperty",
        "value": { "type": "Point", "coordinates": [-3.7038, 40.4168] }
    },
    "@context": ["https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"]
}' > /dev/null

# Entidad 2: Sensor IoT Industrial
curl -s -X POST "$ORION_HOST/ngsi-ld/v1/entities/" \
  -H "Content-Type: application/ld+json" \
  -d '{
    "id": "urn:ngsi-ld:Device:sensor-temp-001",
    "type": "Device",
    "category": { "type": "Property", "value": ["sensor"] },
    "temperature": { "type": "Property", "value": 24.5 },
    "batteryLevel": { "type": "Property", "value": 0.85 },
    "status": { "type": "Property", "value": "online" },
    "@context": ["https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"]
}' > /dev/null

# Entidad 3: Data Asset (Catálogo)
curl -s -X POST "$ORION_HOST/ngsi-ld/v1/entities/" \
  -H "Content-Type: application/ld+json" \
  -d '{
    "id": "urn:ngsi-ld:DataAsset:dataset-001",
    "type": "DataAsset",
    "name": { "type": "Property", "value": "IoT Sensor Telemetry Q1 2025" },
    "description": { "type": "Property", "value": "Real-time temperature and humidity data from industrial sensors" },
    "dataType": { "type": "Property", "value": "iot" },
    "provider": { "type": "Property", "value": "Acme Corp" },
    "@context": ["https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"]
}' > /dev/null

# Entidad 4: Policy (Contrato de Uso)
curl -s -X POST "$ORION_HOST/ngsi-ld/v1/entities/" \
  -H "Content-Type: application/ld+json" \
  -d '{
    "id": "urn:ngsi-ld:Policy:policy-001",
    "type": "Policy",
    "title": { "type": "Property", "value": "Standard Data Access Policy" },
    "description": { "type": "Property", "value": "Permite acceso de lectura con fines analíticos" },
    "action": { "type": "Property", "value": "read" },
    "constraint": { "type": "Property", "value": "purpose:analytics" },
    "@context": ["https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"]
}' > /dev/null

echo ""
echo "================================================================="
echo "✅ ¡ENTORNO LISTO!"
echo "-----------------------------------------------------------------"
echo "1. Credenciales guardadas en: .env.dev"
echo "2. Datos inyectados: 1 Vehículo, 1 Sensor, 1 Data Asset, 1 Policy"
echo "3. PEP Proxy User: pep_user / pep_password_123"
echo ""
echo "📋 Próximos Pasos:"
echo "   - Copia los valores de .env.dev a Supabase Edge Function"
echo "   - Para exponer tu Docker local a Lovable, usa:"
echo "     ngrok http 1027"
echo "   - Actualiza FIWARE_HOST con la URL de ngrok"
echo "================================================================="
