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
```

### 1.2 Generar Certificados Dummy (TRUE Connector)

⚠️ **CRÍTICO**: El TRUE Connector no arrancará sin certificados. Para desarrollo, usa certificados auto-firmados:

```bash
cd certs

# Generar keystore para el conector
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

**Para producción**: Obtén certificados oficiales IDS desde [AISEC DAPS](https://daps.aisec.fraunhofer.de).

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

### 2.1 Acceder al Admin Panel

1. Abre tu navegador: `http://tu-servidor-ip:3005`
2. Login con:
   - **Email**: `admin@procuredata.com`
   - **Password**: `Admin1234!`

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

### 3.1 Verificar la Edge Function

La Edge Function `fiware-proxy` ya fue creada por Lovable. Verifica que esté desplegada:

1. Ve a **Lovable → Cloud → Edge Functions**
2. Busca `fiware-proxy`
3. Estado: ✅ **Deployed**

### 3.2 Configurar Variables de Entorno en Supabase

1. En Lovable, ve a **Settings → Cloud → Secrets**
2. Edita los secretos con estos valores:

| Secret Name      | Valor                                    |
|------------------|------------------------------------------|
| `FIWARE_HOST`    | `http://tu-servidor-ip:1027`            |
| `IDM_HOST`       | `http://tu-servidor-ip:3005`            |
| `FIWARE_USER`    | `supabase_bot`                          |
| `FIWARE_PASS`    | `BotSecure2024!`                        |

**⚠️ Importante**: 
- `FIWARE_HOST` debe apuntar al **PEP-Proxy** (puerto 1027), NO a Orion directamente (1026)
- Si tu servidor está en localhost, usa `http://host.docker.internal:1027` (macOS/Windows) o la IP local del host (Linux)

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

### Error: `FIWARE_HOST not configured`
**Causa**: Secretos de Supabase vacíos o mal configurados.  
**Solución**: Ve a Settings → Cloud → Secrets y verifica que `FIWARE_HOST` tenga formato URL válido (`http://ip:1027`).

### Error: `Invalid URL: 'password/version'`
**Causa**: Has puesto la contraseña en el campo FIWARE_HOST.  
**Solución**: Actualiza los secretos en el orden correcto (HOST = URL, PASS = contraseña).

### Error: `401 Unauthorized` en Keyrock
**Causa**: Usuario/password incorrectos.  
**Solución**: Verifica que `FIWARE_USER` exista en Keyrock y que `FIWARE_PASS` sea correcto.

### Error: `Connection refused` al TRUE Connector
**Causa**: Puerto 8080 no expuesto o certificados faltantes.  
**Solución**: 
1. Verifica `docker-compose ps` → `true-ecc` debe estar `Up`
2. Revisa logs: `docker-compose logs true-ecc`
3. Si dice `Certificate not found`, repite Paso 1.2 (Generar certificados)

### Error: CORS desde el navegador
**Causa**: Estás llamando a FIWARE directamente sin el proxy.  
**Solución**: Busca en tu código cualquier `fetch('http://...')` y reemplázalo por `supabase.functions.invoke`.

### Error: Mixed Content (HTTP/HTTPS)
**Causa**: Frontend en HTTPS intenta conectar a HTTP interno.  
**Solución**: **Nunca** hagas fetch directo. El proxy maneja la conversión HTTPS → HTTP internamente.

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
