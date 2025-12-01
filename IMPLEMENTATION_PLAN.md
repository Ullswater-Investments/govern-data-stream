# Hoja de Ruta de Implementación Full-Stack
## PROCUREDATA v2 - Espacio de Datos con FIWARE

---

## 🎯 Objetivo Global

Desplegar un **Espacio de Datos Industrial** completo utilizando la arquitectura híbrida:
- **Frontend**: Lovable (React + Vite + Tailwind)
- **Middleware**: Supabase Edge Functions
- **Backend**: FIWARE (Orion-LD, Keyrock, PEP-Proxy, TRUE Connector) en Docker

---

## 📋 Prerequisitos

- [ ] Servidor Linux (Ubuntu 20.04+ recomendado) o VPS con:
  - 4GB RAM mínimo (8GB recomendado)
  - 20GB espacio en disco
  - Docker y Docker Compose instalados
- [ ] Cuenta Supabase activa con proyecto Cloud
- [ ] Acceso a Lovable con proyecto PROCUREDATA creado
- [ ] Dominio o IP pública (opcional para producción)

---

## 🚀 FASE 1: Infraestructura Backend (Docker)

### 1.1 Preparar el Entorno

```bash
# Crear directorio del proyecto
mkdir -p ~/procuredata-fiware
cd ~/procuredata-fiware

# Crear directorios para volúmenes persistentes
mkdir -p data/mongo data/mysql certs

# Verificar que Docker está instalado y funcionando
docker --version
docker compose version

# Verificar recursos del sistema
free -h  # Memoria disponible (mínimo 4GB)
df -h    # Espacio en disco (mínimo 20GB)
```

### 1.1.1 Red Docker Interna: `data_space_net`

**¿Por qué es crítica esta red?**

Los contenedores de FIWARE deben comunicarse entre sí usando **nombres de host internos** (ej: `orion`, `keyrock`, `mongo-db`). Docker Compose crea una red bridge personalizada que:

1. **Aísla el tráfico**: Solo los contenedores en `data_space_net` pueden verse entre sí
2. **Resuelve nombres DNS automáticamente**: `ping mongo-db` funciona dentro de la red sin configuración
3. **Evita conflictos de IP**: La subnet `172.25.0.0/24` previene colisiones con otras redes Docker
4. **Seguridad por defecto**: El frontend NUNCA debe conocer estos nombres internos

```yaml
networks:
  data_space_net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/24  # Rango de IPs internas
```

**Regla de Oro**: El frontend NUNCA accede directamente a esta red. Solo el proxy de Supabase Edge Function se comunica con estos servicios.

### 1.2 Generar Certificados para TRUE Connector

⚠️ **PASO CRÍTICO**: El TRUE Connector requiere certificados X.509 **antes** de iniciar. Sin ellos, el contenedor fallará al arrancar.

**Para desarrollo** (certificados autofirmados):

```bash
cd certs

# Opción 1: Usando OpenSSL (más compatible)
# 1. Generar clave privada
openssl genrsa -out connector-keystore.key 2048

# 2. Generar Certificate Signing Request (CSR)
openssl req -new -key connector-keystore.key -out connector.csr \
  -subj "/C=ES/ST=Madrid/L=Madrid/O=PROCUREDATA/OU=DataSpace/CN=fiware-node-01"

# 3. Generar certificado autofirmado válido por 365 días
openssl x509 -req -days 365 -in connector.csr \
  -signkey connector-keystore.key -out connector-cert.crt

# 4. Convertir a formato PKCS12 (requerido por TRUE Connector)
openssl pkcs12 -export -out connector-keystore.p12 \
  -inkey connector-keystore.key \
  -in connector-cert.crt \
  -password pass:changeit

# 5. Verificar certificados creados
ls -lh
# Deberías ver: connector-keystore.key, connector-cert.crt, connector-keystore.p12

cd ..
```

**Opción 2: Usando keytool (requiere Java JDK)**:

```bash
cd certs

# Generar keystore
keytool -genkeypair \
  -alias selfsigned \
  -keyalg RSA \
  -keysize 2048 \
  -keystore connector-keystore.jks \
  -storepass changeit \
  -dname "CN=procuredata-connector,O=PROCUREDATA,C=ES" \
  -validity 365

# Exportar certificado público
keytool -exportcert \
  -alias selfsigned \
  -keystore connector-keystore.jks \
  -storepass changeit \
  -file connector.crt

cd ..
```

**Para producción**: 
- Certificados deben ser emitidos por el **DAPS** (Dynamic Attribute Provisioning Service)
- Registrados en el Connector Certificate Authority de IDS
- DAPS URL: `https://daps.aisec.fraunhofer.de`
- Contacta a IDS Association para obtener acceso al DAPS

### 1.3 Crear el docker-compose.yml Maestro

Copia el siguiente archivo en `~/procuredata-fiware/docker-compose.yml`:

```yaml
version: "3.9"

networks:
  data_space_net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/24

volumes:
  mongo-db:
  mysql-db:

services:
  # === CEREBRO: Context Broker ===
  mongo-db:
    image: mongo:4.4
    hostname: mongo-db
    container_name: db-mongo
    networks:
      - data_space_net
    volumes:
      - mongo-db:/data/db
    command: --wiredTigerCacheSizeGB 1.5 --nojournal
    restart: unless-stopped

  orion:
    image: fiware/orion-ld:latest
    hostname: orion
    container_name: fiware-orion
    networks:
      - data_space_net
    depends_on:
      - mongo-db
    command: -dbhost mongo-db -logLevel WARN -forwarding true
    restart: unless-stopped

  # === SEGURIDAD: Identity & Access ===
  mysql-db:
    image: mysql:5.7
    hostname: mysql-db
    container_name: db-mysql
    networks:
      - data_space_net
    environment:
      MYSQL_ROOT_PASSWORD: idm_secure_password
      MYSQL_DATABASE: idm
    volumes:
      - mysql-db:/var/lib/mysql
    restart: unless-stopped

  keyrock:
    image: fiware/idm:latest
    hostname: keyrock
    container_name: fiware-keyrock
    networks:
      - data_space_net
    ports:
      - "3005:3005"
    environment:
      IDM_DB_HOST: mysql-db
      IDM_DB_NAME: idm
      IDM_DB_USER: root
      IDM_DB_PASS: idm_secure_password
      IDM_HOST: http://localhost:3005
      IDM_PORT: 3005
      IDM_ADMIN_EMAIL: admin@procuredata.com
      IDM_ADMIN_PASS: Admin1234!
    depends_on:
      - mysql-db
    restart: unless-stopped

  pep-proxy:
    image: fiware/pep-proxy:latest
    hostname: pep-proxy
    container_name: fiware-pep-proxy
    networks:
      - data_space_net
    ports:
      - "1027:1027"  # ⚠️ Este es el puerto que usarás en FIWARE_HOST
    environment:
      PEP_PROXY_APP_HOST: orion
      PEP_PROXY_APP_PORT: 1026
      PEP_PROXY_PORT: 1027
      PEP_PROXY_IDM_HOST: keyrock
      PEP_PROXY_IDM_PORT: 3005
      PEP_PROXY_AUTH_ENABLED: "true"
      PEP_PROXY_PDP: idm
      # Placeholders - Se actualizan en Fase 2
      PEP_PROXY_APP_ID: "placeholder_app_id"
      PEP_PROXY_USERNAME: "pep_proxy_user"
      PEP_PROXY_PASSWORD: "pep_proxy_pass"
    depends_on:
      - keyrock
      - orion
    restart: unless-stopped

  # === SOBERANÍA: IDS Connector ===
  true-connector-ecc:
    image: rdlabengpa/ids_execution_core_container:latest
    hostname: true-ecc
    container_name: true-ecc
    networks:
      - data_space_net
    ports:
      - "8080:8080"
      - "29292:29292"
    volumes:
      - ./certs:/etc/cert
    environment:
      DAPS_URL: https://daps.aisec.fraunhofer.de
      CONNECTOR_ID: urn:ids:connector:procuredata-node-01
      KEYSTORE_NAME: connector-keystore.jks
      KEYSTORE_PASSWORD: changeit
    restart: unless-stopped

  true-connector-data-app:
    image: rdlabengpa/ids_be_data_app:latest
    hostname: true-data-app
    container_name: true-data-app
    networks:
      - data_space_net
    environment:
      ECC_URL: http://true-ecc:8080
      BROKER_URL: http://pep-proxy:1027  # ⚠️ Apunta al proxy seguro
    depends_on:
      - true-connector-ecc
    restart: unless-stopped
```

### 1.4 Iniciar los Servicios

```bash
# Levantar toda la infraestructura
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f

# Verificar que todos los contenedores estén UP
docker-compose ps
```

**Salida esperada:**
```
NAME                  STATUS
fiware-orion          Up 2 minutes
fiware-keyrock        Up 2 minutes
fiware-pep-proxy      Up 2 minutes
db-mongo              Up 2 minutes
db-mysql              Up 2 minutes
true-ecc              Up 2 minutes
true-data-app         Up 2 minutes
```

### 1.5 Verificar la Red Interna

```bash
# Verificar que los contenedores se vean entre sí
docker exec -it fiware-orion ping -c 3 mongo-db
docker exec -it fiware-pep-proxy ping -c 3 keyrock
```

---

## 🔐 FASE 2: Provisionamiento de Identidad (Keyrock)

### 2.1 Script de Provisionamiento Automático (Recomendado)

**Objetivo**: Crear automáticamente la aplicación "Orion" en Keyrock y generar credenciales para PEP-Proxy.

Crea un archivo `provision-keyrock.sh` en la raíz del proyecto:

```bash
#!/bin/bash
# provision-keyrock.sh - Inicialización automática de Keyrock

KEYROCK_URL="http://localhost:3005"
ADMIN_EMAIL="admin@procuredata.com"
ADMIN_PASS="Admin1234!"

echo "🔐 FASE 2: Provisionamiento de Keyrock Identity Manager"
echo "=========================================================="

# Esperar a que Keyrock esté listo
echo "⏳ Esperando a que Keyrock inicie..."
until curl -sf "$KEYROCK_URL/version" > /dev/null; do
  sleep 2
done
echo "✅ Keyrock disponible"

# 1. Obtener token de administrador
echo ""
echo "🔑 Autenticando como administrador..."
AUTH_RESPONSE=$(curl -s -X POST "$KEYROCK_URL/v1/auth/tokens" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASS\"
  }")

TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Error: No se pudo obtener token de admin"
  echo "Verifica ADMIN_EMAIL y ADMIN_PASS en Keyrock"
  exit 1
fi

echo "✅ Token obtenido"

# 2. Crear aplicación "Orion Context Broker"
echo ""
echo "📱 Creando aplicación Orion..."
APP_RESPONSE=$(curl -s -X POST "$KEYROCK_URL/v1/applications" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{
    "application": {
      "name": "PROCUREDATA Context Broker",
      "description": "Secure access to Orion-LD via PEP-Proxy",
      "redirect_uri": "http://localhost:1027/login",
      "url": "http://localhost:1027",
      "grant_type": [
        "authorization_code",
        "implicit",
        "password"
      ],
      "token_types": [
        "permanent"
      ]
    }
  }')

APP_ID=$(echo "$APP_RESPONSE" | jq -r '.application.id')
APP_SECRET=$(echo "$APP_RESPONSE" | jq -r '.application.secret')

if [ "$APP_ID" == "null" ]; then
  echo "❌ Error: No se pudo crear la aplicación"
  exit 1
fi

echo "✅ Aplicación creada:"
echo "   APP_ID: $APP_ID"
echo "   APP_SECRET: $APP_SECRET"

# 3. Crear usuario "PEP Proxy"
echo ""
echo "👤 Creando usuario PEP Proxy..."
PEP_USER_RESPONSE=$(curl -s -X POST "$KEYROCK_URL/v1/users" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{
    "user": {
      "username": "pep_proxy_user",
      "email": "pep@procuredata.com",
      "password": "PepProxy2024!"
    }
  }')

PEP_USER_ID=$(echo "$PEP_USER_RESPONSE" | jq -r '.user.id')
echo "✅ Usuario PEP creado: $PEP_USER_ID"

# 4. Asignar rol PEP Proxy
echo ""
echo "🔐 Asignando rol PEP Proxy..."
ROLE_RESPONSE=$(curl -s -X POST "$KEYROCK_URL/v1/applications/$APP_ID/pep_proxies" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d "{
    \"pep_proxy\": {
      \"user_id\": \"$PEP_USER_ID\"
    }
  }")

PEP_ID=$(echo "$ROLE_RESPONSE" | jq -r '.pep_proxy.id')
PEP_PASSWORD=$(echo "$ROLE_RESPONSE" | jq -r '.pep_proxy.password')

echo "✅ PEP Proxy configurado:"
echo "   PEP_PROXY_USERNAME: $PEP_ID"
echo "   PEP_PROXY_PASSWORD: $PEP_PASSWORD"

# 5. Crear usuario Bot (para Supabase Edge Function)
echo ""
echo "🤖 Creando usuario bot para Supabase..."
BOT_RESPONSE=$(curl -s -X POST "$KEYROCK_URL/v1/users" \
  -H "Content-Type: application/json" \
  -H "X-Auth-Token: $TOKEN" \
  -d '{
    "user": {
      "username": "supabase_bot",
      "email": "bot@procuredata.com",
      "password": "BotSecure2024!"
    }
  }')

BOT_USER_ID=$(echo "$BOT_RESPONSE" | jq -r '.user.id')
echo "✅ Usuario bot creado: $BOT_USER_ID"

# 6. Guardar credenciales
echo ""
echo "💾 Guardando credenciales en .env.keyrock..."
cat > .env.keyrock <<EOF
# Keyrock Application Credentials
# Generated on $(date)

PEP_PROXY_APP_ID=$APP_ID
PEP_PROXY_USERNAME=$PEP_ID
PEP_PROXY_PASSWORD=$PEP_PASSWORD
PEP_PROXY_APP_SECRET=$APP_SECRET

# Supabase Bot Credentials
FIWARE_USER=bot@procuredata.com
FIWARE_PASS=BotSecure2024!

# Instrucciones:
# 1. Copia estas variables al docker-compose.yml (servicio pep-proxy)
# 2. Copia FIWARE_USER y FIWARE_PASS a Lovable Cloud Secrets
EOF

echo "✅ Credenciales guardadas en .env.keyrock"
echo ""
echo "🎉 Provisionamiento completado exitosamente"
echo ""
echo "⚠️  PRÓXIMOS PASOS:"
echo "1. cat .env.keyrock  # Ver credenciales"
echo "2. Actualizar docker-compose.yml con PEP_PROXY_* variables"
echo "3. docker compose restart pep-proxy"
echo "4. Configurar FIWARE_USER y FIWARE_PASS en Lovable Cloud"
```

**Ejecutar el script:**

```bash
# Dar permisos de ejecución
chmod +x provision-keyrock.sh

# Ejecutar (Keyrock debe estar corriendo)
./provision-keyrock.sh

# Ver credenciales generadas
cat .env.keyrock
```

### 2.2 Método Manual (Alternativa)

### 2.2 Registrar la Aplicación "Orion-LD"

1. **Applications** → **Register a new application**
2. Completar:
   - **Name**: `PROCUREDATA Context Broker`
   - **Description**: `Secure access to Orion-LD via PEP-Proxy`
   - **URL**: `http://tu-servidor-ip:1027`
   - **Callback URL**: `http://tu-servidor-ip:1027/auth/fiware/callback`
   - **Grant Type**: `authorization_code`
3. **Save** → Copia:
   - `Client ID` (ej: `7a8b9c0d-1234-5678-abcd-ef0123456789`)
   - `Client Secret` (ej: `abc123def456...`)

### 2.3 Crear Usuario PEP Proxy

1. **Users** → **Create user**
2. Datos:
   - **Username**: `pep_proxy_user`
   - **Email**: `pep@procuredata.com`
   - **Password**: `PepProxy2024!`
3. **Roles** → Assign **PEP Proxy** role
4. **Save**

### 2.4 Crear Usuario Bot (para el proxy Supabase)

1. **Users** → **Create user**
2. Datos:
   - **Username**: `supabase_bot`
   - **Email**: `bot@procuredata.com`
   - **Password**: `BotSecure2024!`
3. **Roles** → Assign **Provider** role (puede leer/escribir entidades)

### 2.5 Actualizar el docker-compose.yml

```bash
# Editar el archivo
nano docker-compose.yml

# En la sección pep-proxy, reemplazar:
PEP_PROXY_APP_ID: "7a8b9c0d-1234-5678-abcd-ef0123456789"  # Tu Client ID
PEP_PROXY_USERNAME: "pep_proxy_user"
PEP_PROXY_PASSWORD: "PepProxy2024!"

# Guardar (Ctrl+O, Enter, Ctrl+X)

# Reiniciar solo el PEP-Proxy
docker-compose restart pep-proxy

# Verificar logs
docker-compose logs pep-proxy
```

**Log correcto:**
```
[INFO] PEP Proxy started
[INFO] Connected to Keyrock at http://keyrock:3005
[INFO] Listening on port 1027
```

---

## 🌐 FASE 3: Middleware (Supabase Edge Functions)

### 3.1 Edge Function: fiware-proxy

La función `supabase/functions/fiware-proxy/index.ts` ya fue creada por Lovable. Verifica su estructura:

```typescript
// supabase/functions/fiware-proxy/index.ts
const FIWARE_HOST = Deno.env.get('FIWARE_HOST')  // http://tu-servidor:1027
const IDM_HOST = Deno.env.get('IDM_HOST')        // http://tu-servidor:3005
const BOT_USER = Deno.env.get('FIWARE_USER')     // bot@procuredata.com
const BOT_PASS = Deno.env.get('FIWARE_PASS')     // BotSecure2024!
```

**Verificar despliegue:**

1. Ve a **Lovable → Cloud → Edge Functions**
2. Busca `fiware-proxy`
3. Estado: ✅ **Deployed**

### 3.2 Configurar Variables de Entorno (Secrets)

**⚠️ VARIABLES CRÍTICAS**: Estas 4 variables DEBEN estar configuradas correctamente para que el proxy funcione:

| Variable | Descripción | Ejemplo de Valor | ⚠️ Errores Comunes |
|----------|-------------|------------------|---------------------|
| `FIWARE_HOST` | **URL completa del PEP-Proxy** (punto de entrada seguro a Orion) | `http://45.79.123.45:1027` | ❌ NO poner contraseña aquí<br>❌ NO usar puerto 1026 (Orion directo)<br>❌ NO olvidar `http://` |
| `IDM_HOST` | **URL de Keyrock** Identity Manager | `http://45.79.123.45:3005` | ❌ NO usar puerto 1027<br>✅ Debe terminar en :3005 |
| `FIWARE_USER` | **Email del usuario bot** en Keyrock | `bot@procuredata.com` | ❌ NO usar admin@procuredata.com<br>✅ Crear usuario específico para el bot |
| `FIWARE_PASS` | **Contraseña del bot** | `BotSecure2024!` | ❌ NO poner URL aquí<br>✅ Debe coincidir con password de Keyrock |

**Pasos para configurar en Lovable Cloud:**

1. En Lovable, ve a **Settings → Cloud → Secrets**
2. Haz clic en **Edit** para cada secret
3. **IMPORTANTE**: Verifica el formato antes de guardar:

```bash
# ✅ CORRECTO
FIWARE_HOST=http://45.79.123.45:1027
IDM_HOST=http://45.79.123.45:3005
FIWARE_USER=bot@procuredata.com
FIWARE_PASS=BotSecure2024!

# ❌ INCORRECTO (estos son errores reales que ocurrieron)
FIWARE_HOST=BotSecure2024!  # ← Password en lugar de URL
FIWARE_HOST=45.79.123.45:1027  # ← Falta el http://
FIWARE_HOST=http://orion:1026  # ← Puerto de Orion directo (sin seguridad)
```

**Consejos de configuración:**

- Si tu servidor está en **localhost** (desarrollo local):
  - macOS/Windows: `http://host.docker.internal:1027`
  - Linux: Usa la IP local del host (ej: `http://192.168.1.100:1027`)
- Si tu servidor está en un **VPS** (producción):
  - Usa la IP pública: `http://45.79.123.45:1027`
  - O un dominio: `http://fiware.tudominio.com:1027`

### 3.3 Test del Proxy desde Postman/curl

```bash
# Obtener el endpoint de tu proyecto
SUPABASE_URL="https://tu-proyecto.supabase.co"
SUPABASE_ANON_KEY="tu-anon-key"

# Test: Health check de Orion
curl -X POST "$SUPABASE_URL/functions/v1/fiware-proxy" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/version",
    "method": "GET",
    "skipAuth": true
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": {
    "orion": {
      "version": "1.6.0",
      "uptime": "0 d, 1 h, 23 m, 45 s"
    }
  },
  "status": "connected"
}
```

---

## 🎨 FASE 4: Integración Frontend (Lovable)

### 4.1 Verificar el Servicio fiwareApi.ts

El archivo `src/services/fiwareApi.ts` ya está creado. Verifica que use `supabase.functions.invoke` y NO `fetch` directo.

### 4.2 Actualizar el Dashboard

El Dashboard en `/dashboard` ya muestra:
- **4 métricas** de Supabase (Transacciones, Assets)
- **1 métrica FIWARE** (Entidades en Orion-LD en tiempo real)

Navega a `/dashboard` y verifica:
- ✅ "FIWARE Entities" muestra `> 0` si hay entidades
- ❌ Si muestra `0`, significa que Orion está vacío (normal en instalación nueva)

### 4.3 Crear Tu Primera Entidad de Prueba

Desde tu navegador, abre la consola de DevTools y ejecuta:

```javascript
const { data } = await supabase.functions.invoke('fiware-proxy', {
  body: {
    path: '/ngsi-ld/v1/entities',
    method: 'POST',
    body: {
      id: 'urn:ngsi-ld:Device:test001',
      type: 'Device',
      name: {
        type: 'Property',
        value: 'Sensor de Prueba'
      },
      temperature: {
        type: 'Property',
        value: 22.5,
        unitCode: 'CEL'
      },
      location: {
        type: 'GeoProperty',
        value: {
          type: 'Point',
          coordinates: [-3.7038, 40.4168] // Madrid
        }
      },
      '@context': [
        'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld',
        'https://smartdatamodels.org/context.jsonld'
      ]
    }
  }
});

console.log(data);
```

### 4.4 Ver la Entidad en el Admin Panel

1. Navega a `/admin/fiware-node`
2. Pestaña: **Context Broker**
3. Deberías ver: `Device: Sensor de Prueba`
4. Click en **Ver JSON-LD** para inspeccionar la estructura completa

### 4.5 Ver el Dispositivo en el Mapa

Si la entidad tiene coordenadas `location`, aparecerá automáticamente en el **Mapa de Flota IoT** en la misma página.

---

## ✅ Checklist de Validación Final

### Backend (Docker)
- [ ] `docker-compose ps` muestra todos los servicios `Up`
- [ ] Keyrock accesible en `http://ip:3005`
- [ ] PEP-Proxy responde en `http://ip:1027/version`
- [ ] MongoDB tiene datos: `docker exec -it db-mongo mongosh --eval "use orion; db.entities.countDocuments()"`

### Middleware (Supabase)
- [ ] Edge Function `fiware-proxy` desplegada
- [ ] Secretos configurados correctamente (FIWARE_HOST, IDM_HOST, etc.)
- [ ] Test curl devuelve `"status": "connected"`
- [ ] Logs no muestran errores de autenticación

### Frontend (Lovable)
- [ ] Dashboard muestra métricas de FIWARE en tiempo real
- [ ] `/admin/fiware-node` lista entidades NGSI-LD
- [ ] Mapa de flota visible si hay dispositivos con ubicación
- [ ] Crear usuario en Keyrock funciona desde el formulario

---

## ⚠️ Errores Comunes y Soluciones

### Error 1: "CORS policy blocked"

**Síntoma en consola del navegador:**
```
Access to fetch at 'http://45.79.123.45:1026/ngsi-ld/v1/entities' from origin 'https://yourapp.lovable.app' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Causa**: El frontend está intentando hacer `fetch` directo a FIWARE (regla de seguridad prohibida).

**Solución**:
```typescript
// ❌ NUNCA HACER ESTO
const response = await fetch('http://45.79.123.45:1026/ngsi-ld/v1/entities')

// ❌ TAMPOCO ESTO
const response = await fetch('http://orion:1026/ngsi-ld/v1/entities')

// ✅ SIEMPRE USAR EL PROXY
const { data } = await supabase.functions.invoke('fiware-proxy', {
  body: { 
    path: '/ngsi-ld/v1/entities', 
    method: 'GET' 
  }
})
```

**Cómo verificar**: Busca en tu código cualquier `fetch('http://...')` que no sea a Supabase.

---

### Error 2: "Mixed Content: insecure request from HTTPS"

**Síntoma en consola:**
```
Mixed Content: The page at 'https://yourapp.lovable.app' was loaded over HTTPS, 
but requested an insecure resource 'http://45.79.123.45:1026/...'. 
This request has been blocked; the content must be served over HTTPS.
```

**Causa**: Tu app Lovable está en **HTTPS**, FIWARE está en **HTTP**. Los navegadores modernos bloquean este mix por seguridad (política Mixed Content).

**Por qué ocurre**:
- Lovable hosting: `https://yourapp.lovable.app` (HTTPS ✅)
- FIWARE backend: `http://tu-servidor:1026` (HTTP ⚠️)
- Navegador: "HTTPS → HTTP = BLOQUEADO 🚫"

**Solución**: El proxy (Edge Function de Supabase) se ejecuta en el **backend** (servidor a servidor), donde no hay restricciones Mixed Content:

```
Usuario → HTTPS → Lovable Frontend → HTTPS → Supabase Edge Function → HTTP → FIWARE
                  (navegador)                  (servidor, sin restricciones)
```

**Verificación**: NUNCA deberías ver URLs con `http://` en el código React. Solo `supabase.functions.invoke`.

---

### Error 3: "Invalid URL" en logs de Edge Function

**Síntoma en Lovable Cloud → Edge Functions → fiware-proxy → Logs:**
```
Error: Invalid URL
  at new URL (deno:///core/01_urls.js:...)
  at file:///src/functions/fiware-proxy/index.ts:32:15
```

**Causa**: `FIWARE_HOST` está mal configurado. Casos reales:
- ❌ `FIWARE_HOST=BotSecure2024!` (password en vez de URL)
- ❌ `FIWARE_HOST=45.79.123.45:1027` (falta el `http://`)
- ❌ `FIWARE_HOST=orion:1026` (nombre de contenedor Docker, no accesible desde internet)

**Solución**:
1. Ve a **Settings → Cloud → Secrets**
2. Edita `FIWARE_HOST`
3. Debe ser: `http://tu-ip-publica:1027`
4. Guarda y espera 1 minuto para que se aplique

**Verificación**:
```bash
# Testear manualmente que el URL es válido
curl http://tu-ip:1027/version
# Debería devolver JSON con versión de Orion-LD
```

---

### Error 4: "401 Unauthorized" en Keyrock

**Síntoma en logs de Edge Function:**
```json
{ 
  "error": { 
    "message": "Invalid credentials", 
    "code": 401 
  } 
}
```

**Causa**: Usuario/contraseña incorrectos en `FIWARE_USER`/`FIWARE_PASS`.

**Diagnóstico**:
```bash
# 1. Verificar que el usuario existe en Keyrock
docker exec -it fiware-keyrock mysql -u root -pidm -e \
  "SELECT email FROM idm.user WHERE email='bot@procuredata.com';"

# 2. Probar credenciales manualmente
curl -X POST http://tu-servidor:3005/v1/auth/tokens \
  -H "Content-Type: application/json" \
  -d '{
    "name": "bot@procuredata.com",
    "password": "BotSecure2024!"
  }'

# Respuesta esperada:
# { "token": "abc123...", "expires_at": "..." }
```

**Solución**:
1. Si el usuario no existe, créalo en Keyrock UI o con el script `provision-keyrock.sh`
2. Actualiza `FIWARE_USER` y `FIWARE_PASS` en Lovable Cloud Secrets
3. Asegúrate de que coincidan con Keyrock

---

### Error 5: "Connection refused" al PEP-Proxy

**Síntoma en logs de Edge Function:**
```
fetch failed: connect ECONNREFUSED 45.79.123.45:1027
```

**Causa**: El contenedor PEP-Proxy no está corriendo o tiene credenciales incorrectas.

**Diagnóstico**:
```bash
# 1. Verificar estado del contenedor
docker ps | grep pep-proxy
# Debe mostrar: fiware-pep-proxy   Up X minutes

# 2. Ver logs del PEP-Proxy
docker logs fiware-pep-proxy --tail 50

# 3. Buscar errores como:
# - "Error connecting to Keyrock"
# - "Invalid PEP_PROXY_APP_ID"
# - "Cannot reach Orion at orion:1026"
```

**Solución**:
```bash
# 1. Verificar variables en docker-compose.yml
nano docker-compose.yml
# Sección pep-proxy:
#   PEP_PROXY_APP_ID: "tu-app-id-real"  ← Debe coincidir con Keyrock
#   PEP_PROXY_USERNAME: "pep-user-id"
#   PEP_PROXY_PASSWORD: "pep-password"

# 2. Reiniciar PEP-Proxy con credenciales correctas
docker compose restart pep-proxy

# 3. Verificar que arrancó correctamente
docker logs fiware-pep-proxy
# Buscar: "[INFO] PEP Proxy started" y "Listening on port 1027"
```

---

### Error 6: TRUE Connector no inicia (certificados faltantes)

**Síntoma en logs:**
```
ERROR: Keystore file not found: /etc/cert/connector-keystore.p12
java.io.FileNotFoundException: /etc/cert/connector-keystore.p12
```

**Causa**: No se generaron los certificados antes de ejecutar `docker compose up`.

**Solución**: Volver a la **Fase 1.2** y ejecutar los comandos de OpenSSL para generar certificados.

```bash
# Detener los contenedores
docker compose down

# Generar certificados
cd certs
openssl genrsa -out connector-keystore.key 2048
# ... (seguir pasos de Fase 1.2)

# Reiniciar
cd ..
docker compose up -d
```

---

### Error 7: "FIWARE_HOST not configured" (modo standby)

**Síntoma en el frontend:**
```
⚠️ FIWARE Backend not configured
Status: Standby Mode
```

**Causa**: Los secrets de Lovable Cloud no tienen valores válidos.

**Solución**:
1. Ve a **Settings → Cloud → Secrets**
2. Verifica que TODOS los 4 secrets tengan valores:
   - `FIWARE_HOST` = `http://tu-ip:1027` (URL completa)
   - `IDM_HOST` = `http://tu-ip:3005` (URL completa)
   - `FIWARE_USER` = `bot@procuredata.com` (email)
   - `FIWARE_PASS` = `BotSecure2024!` (password)
3. Guarda cambios
4. Espera 1-2 minutos para que se apliquen
5. Recarga la página del frontend

---

### Debugging Avanzado: Ver logs en tiempo real

```bash
# Todos los servicios
docker compose logs -f

# Solo Orion-LD
docker compose logs -f orion

# Solo PEP-Proxy (para ver autenticación)
docker compose logs -f pep-proxy

# Solo Keyrock (para ver creación de tokens)
docker compose logs -f keyrock

# Filtrar por error
docker compose logs | grep ERROR
```

---

## 🚀 Próximos Pasos (Post-Despliegue)

1. **Poblar el Context Broker** con datos reales (sensores, activos)
2. **Configurar Suscripciones NGSI-LD** para notificaciones en tiempo real
3. **Crear Políticas ODRL** para compartir datos con otros espacios IDS
4. **Monitorear Logs** de Orion-LD para debugging:
   ```bash
   docker-compose logs -f fiware-orion
   ```
5. **Backups Periódicos**:
   ```bash
   docker exec db-mongo mongodump --out /data/backup
   docker cp db-mongo:/data/backup ./backups/$(date +%Y%m%d)
   ```

---

## 📚 Referencias Técnicas

- [Orion-LD Installation Guide](https://fiware-orion.readthedocs.io/en/latest/admin/install/)
- [Keyrock User Guide](https://fiware-idm.readthedocs.io/)
- [PEP-Proxy Configuration](https://fiware-pep-proxy.readthedocs.io/)
- [TRUE Connector Docs](https://github.com/Engineering-Research-and-Development/true-connector)
- [Smart Data Models Catalog](https://smartdatamodels.org/)

---

## 🆘 Soporte

Si encuentras problemas:
1. Revisa logs: `docker-compose logs [servicio]`
2. Verifica conectividad: `docker exec -it [contenedor] ping [otro-contenedor]`
3. Consulta el `DEVELOPER_GUIDE.md` para ejemplos de código
4. Revisa el `ARCHITECTURE_V2.md` para entender el diseño completo

**¡Tu Espacio de Datos industrial está listo para operar! 🎉**
