# 🏗️ Guía de Despliegue FIWARE para PROCUREDATA v2

Esta guía detalla cómo desplegar la infraestructura completa de FIWARE (Orion-LD, Keyrock, PEP-Proxy, TRUE Connector) en un servidor VPS o local para conectarlo con PROCUREDATA.

---

## 📋 Requisitos Previos

- **Docker** y **Docker Compose** instalados
- **4GB RAM mínimo** (8GB recomendado)
- **Puerto 80/443** abierto para acceso HTTP/HTTPS
- **Certificados IDS** (opcional para TRUE Connector)

---

## 🐳 Paso 1: Docker Compose Completo

Crea un archivo `docker-compose.yml` en tu servidor:

```yaml
version: "3.9"

networks:
  data_space_net:
    driver: bridge

volumes:
  mongo-db:
  mysql-db:
  ids-certs:

services:
  # === BASES DE DATOS ===
  
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

  mysql-db:
    image: mysql:5.7
    hostname: mysql-db
    container_name: db-mysql
    networks:
      - data_space_net
    environment:
      MYSQL_ROOT_PASSWORD: idm_password
      MYSQL_DATABASE: idm
    volumes:
      - mysql-db:/var/lib/mysql
    restart: unless-stopped

  # === CONTEXT BROKER (Cerebro de Datos) ===
  
  orion:
    image: fiware/orion-ld:latest
    hostname: orion
    container_name: fiware-orion
    networks:
      - data_space_net
    depends_on:
      - mongo-db
    ports:
      - "1026:1026"  # API NGSI-LD sin protección (uso interno)
    command: -dbhost mongo-db -logLevel WARN -forwarding true
    restart: unless-stopped

  # === IDENTITY MANAGEMENT ===
  
  keyrock:
    image: fiware/idm:latest
    hostname: keyrock
    container_name: fiware-keyrock
    networks:
      - data_space_net
    ports:
      - "3005:3005"  # Admin Panel y API
    environment:
      IDM_DB_HOST: mysql-db
      IDM_DB_NAME: idm
      IDM_DB_USER: root
      IDM_DB_PASS: idm_password
      IDM_HOST: http://localhost:3005
      IDM_PORT: 3005
      IDM_ADMIN_EMAIL: admin@procuredata.com
      IDM_ADMIN_PASS: Admin1234!
    depends_on:
      - mysql-db
    restart: unless-stopped

  # === PEP PROXY (Punto de Acceso Seguro) ===
  
  pep-proxy:
    image: fiware/pep-proxy:latest
    hostname: pep-proxy
    container_name: fiware-pep-proxy
    networks:
      - data_space_net
    ports:
      - "1027:1027"  # Este es el puerto que usarás en FIWARE_HOST
    environment:
      PEP_PROXY_APP_HOST: orion
      PEP_PROXY_APP_PORT: 1026
      PEP_PROXY_PORT: 1027
      PEP_PROXY_IDM_HOST: keyrock
      PEP_PROXY_IDM_PORT: 3005
      PEP_PROXY_AUTH_ENABLED: "true"
      PEP_PROXY_PDP: idm
      # Estas credenciales deben generarse en Keyrock
      PEP_PROXY_APP_ID: "to-be-generated"
      PEP_PROXY_USERNAME: "pep_proxy_user"
      PEP_PROXY_PASSWORD: "pep_proxy_password"
    depends_on:
      - keyrock
      - orion
    restart: unless-stopped

  # === TRUE CONNECTOR (IDS - Soberanía de Datos) ===
  
  true-connector-ecc:
    image: rdlabengpa/ids_execution_core_container:latest
    hostname: true-ecc
    container_name: true-ecc
    networks:
      - data_space_net
    ports:
      - "8080:8080"   # API Gestión
      - "29292:29292" # Canal Seguro IDS
    volumes:
      - ./certs:/etc/cert
    environment:
      DAPS_URL: https://daps.aisec.fraunhofer.de
      CONNECTOR_ID: urn:ids:connector:procuredata-node-01
      KEYSTORE_PASSWORD: password
    restart: unless-stopped

  true-connector-data-app:
    image: rdlabengpa/ids_be_data_app:latest
    hostname: true-data-app
    container_name: true-data-app
    networks:
      - data_space_net
    environment:
      ECC_URL: http://true-ecc:8080
      BROKER_URL: http://pep-proxy:1027
    depends_on:
      - true-connector-ecc
    restart: unless-stopped
```

---

## 🚀 Paso 2: Levantar los Servicios

```bash
# Navegar al directorio donde está docker-compose.yml
cd /ruta/a/tu/directorio

# Iniciar todos los servicios
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f

# Verificar que todos los contenedores estén corriendo
docker-compose ps
```

Deberías ver todos los servicios con estado `Up`.

---

## 🔑 Paso 3: Configurar Keyrock (Identity Management)

### 3.1 Acceder al Admin Panel

1. Abre tu navegador: `http://tu-servidor-ip:3005`
2. Login:
   - **Email**: `admin@procuredata.com`
   - **Password**: `Admin1234!`

### 3.2 Crear Aplicación para PEP-Proxy

1. **Applications** → **Register a new application**
2. **Name**: `PROCUREDATA Context Broker`
3. **URL**: `http://tu-servidor-ip:1027`
4. **Callback URL**: `http://tu-servidor-ip:1027/auth/fiware/callback`
5. **Guardar** → Copia el `App ID` y el `App Secret`

### 3.3 Crear Usuario PEP Proxy

1. **Users** → **Create user**
2. **Username**: `pep_proxy_user`
3. **Email**: `pep@procuredata.com`
4. **Password**: `pep_proxy_password`
5. **Assign Role**: `PEP Proxy`

### 3.4 Actualizar PEP-Proxy

Edita `docker-compose.yml` y actualiza las variables:

```yaml
PEP_PROXY_APP_ID: "el-app-id-copiado"
PEP_PROXY_USERNAME: "pep_proxy_user"
PEP_PROXY_PASSWORD: "pep_proxy_password"
```

Reinicia el PEP-Proxy:

```bash
docker-compose restart pep-proxy
```

---

## 🔗 Paso 4: Configurar Secretos en Supabase

En tu proyecto de Lovable, los secretos ya están configurados. Solo necesitas verificar que tengan los valores correctos:

1. **FIWARE_HOST**: `http://tu-servidor-ip:1027` (PEP-Proxy protegido)
2. **FIWARE_USER**: `tu-usuario-keyrock`
3. **FIWARE_PASS**: `tu-password-keyrock`
4. **IDM_HOST**: `http://tu-servidor-ip:3005`

### Para uso local (desarrollo):

Si estás desarrollando localmente, puedes usar:
- **FIWARE_HOST**: `http://localhost:1027`
- **IDM_HOST**: `http://localhost:3005`

---

## ✅ Paso 5: Probar la Conexión

### 5.1 Test del Context Broker (directo, sin auth)

```bash
curl http://tu-servidor-ip:1026/version
```

Debería devolver información de versión de Orion-LD.

### 5.2 Test de Keyrock

```bash
curl -X POST http://tu-servidor-ip:3005/v1/auth/tokens \
  -H "Content-Type: application/json" \
  -d '{
    "name": "admin@procuredata.com",
    "password": "Admin1234!"
  }' \
  -i
```

Debería devolver un header `X-Subject-Token`.

### 5.3 Test desde PROCUREDATA

En la aplicación Lovable, navega a `/admin/fiware-node` y verifica:

1. ✅ **Orion-LD**: Estado "Conectado"
2. ✅ **Keyrock**: Estado "Conectado"
3. ✅ **TRUE Connector**: Estado "Conectado" (si configuraste certificados)

---

## 📊 Paso 6: Crear Tu Primera Entidad

### Desde la API (curl):

```bash
curl -X POST http://tu-servidor-ip:1026/ngsi-ld/v1/entities \
  -H "Content-Type: application/ld+json" \
  -d '{
    "id": "urn:ngsi-ld:Device:sensor001",
    "type": "Device",
    "name": {
      "type": "Property",
      "value": "Sensor de Temperatura"
    },
    "temperature": {
      "type": "Property",
      "value": 23.5,
      "unitCode": "CEL"
    },
    "@context": [
      "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"
    ]
  }'
```

### Desde PROCUREDATA:

Usa el servicio `fiwareApi` en tu código:

```typescript
import { fiwareApi, toNgsiEntity } from '@/services/fiwareApi';

const createSensor = async () => {
  const entity = toNgsiEntity({
    id: 'urn:ngsi-ld:Device:sensor001',
    name: 'Sensor de Temperatura',
    temperature: 23.5
  }, 'Device');

  const result = await fiwareApi.createEntity(entity);
  console.log(result);
};
```

---

## 🔒 Paso 7: TRUE Connector (Opcional - IDS)

### 7.1 Generar Certificados

Si no tienes certificados DAPS:

```bash
mkdir certs
cd certs

# Generar keystore auto-firmado (solo desarrollo)
keytool -genkeypair -alias selfsigned \
  -keyalg RSA -keysize 2048 \
  -keystore keystore.jks \
  -storepass password \
  -dname "CN=procuredata-node,O=PROCUREDATA,C=ES"
```

### 7.2 Conectar con DAPS Real (Producción)

Para producción, necesitas:
1. Registrarte en AISEC (https://daps.aisec.fraunhofer.de)
2. Obtener certificados oficiales IDS
3. Configurar `connector.cert` y `connector.key`

---

## 🛠️ Troubleshooting

### Problema: "Error 401 Unauthorized"

**Solución**: Verifica que el usuario existe en Keyrock y que los secretos FIWARE_USER/FIWARE_PASS son correctos.

### Problema: "Connection refused"

**Solución**: 
1. Verifica que los contenedores estén corriendo: `docker-compose ps`
2. Revisa logs: `docker-compose logs keyrock orion pep-proxy`
3. Verifica que los puertos no estén bloqueados por firewall

### Problema: "FIWARE backend not configured"

**Solución**: Los secretos en Supabase están vacíos o mal configurados. Ve a Settings → Cloud → Secrets y verifica FIWARE_HOST.

---

## 🎯 Próximos Pasos

1. ✅ **Verificar estado** en `/admin/fiware-node`
2. 📊 **Crear entidades IoT** de ejemplo
3. 👥 **Configurar usuarios** en Keyrock
4. 🔐 **Definir políticas IDS** en TRUE Connector
5. 🔄 **Integrar con Catalog** para sincronizar Data Assets

---

## 📚 Documentación Oficial

- **Orion-LD**: https://fiware-orion.readthedocs.io/
- **Keyrock**: https://fiware-idm.readthedocs.io/
- **PEP-Proxy**: https://fiware-pep-proxy.readthedocs.io/
- **TRUE Connector**: https://github.com/Engineering-Research-and-Development/true-connector

---

## 🆘 Soporte

Si encuentras problemas durante el despliegue:

1. Revisa los logs: `docker-compose logs -f [servicio]`
2. Verifica conectividad de red entre contenedores
3. Consulta el panel `/admin/fiware-node` en PROCUREDATA

¡Tu Espacio de Datos industrial está listo! 🚀
