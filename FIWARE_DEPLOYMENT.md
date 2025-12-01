# Guía de Despliegue FIWARE - Desarrollo Local y Producción

## 🎯 Objetivo

Esta guía te ayudará a desplegar FIWARE localmente para desarrollo y posteriormente migrar a producción sin fricción.

---

## 🚀 Fase 1: Desarrollo Local

### 1.1 Levantar el Stack FIWARE

**Prerequisitos:**
- Docker y Docker Compose instalados
- Al menos 4GB de RAM disponible
- Puertos libres: 1026, 1027, 3005, 27017, 3306, 8080, 8443

**Iniciar contenedores:**

```bash
# Clonar el repositorio (si aún no lo has hecho)
git clone <tu-repo>
cd <tu-repo>

# Levantar todos los servicios
docker-compose up -d

# Verificar que todos los contenedores están corriendo
docker-compose ps
```

**Salida esperada:**

```
NAME                     STATUS          PORTS
orion-ld                 Up              0.0.0.0:1026->1026/tcp
mongo                    Up              27017/tcp
keyrock                  Up              0.0.0.0:3005->3005/tcp
mysql                    Up              3306/tcp
pep-proxy                Up              0.0.0.0:1027->1027/tcp
true-connector-ecc       Up              0.0.0.0:8080->8080/tcp
true-connector-data-app  Up              8083/tcp
```

### 1.2 Ejecutar Script de Inicialización

El script `setup_dev_env.sh` automatiza:
- Autenticación en Keyrock como admin
- Creación de aplicación OAuth2
- Creación de usuarios de servicio (PEP Proxy)
- Inyección de datos de prueba en Orion-LD

```bash
chmod +x setup_dev_env.sh
./setup_dev_env.sh
```

**Resultado:**
```
🚀 Iniciando configuración del entorno de desarrollo...
✅ Keyrock está online.
🔑 Obteniendo token de administrador...
📦 Registrando aplicación 'PROCUREDATA Core'...
👤 Creando usuario de servicio 'pep_user'...
📝 Generando archivo '.env.dev' con las credenciales...
🌱 Sembrando datos de prueba en Orion-LD...

================================================================
✅ ¡ENTORNO LISTO!
-----------------------------------------------------------------
1. Credenciales guardadas en: .env.dev
2. Datos inyectados: 1 Vehículo, 1 Sensor, 1 Data Asset, 1 Policy
3. PEP Proxy User: pep_user / pep_password_123
================================================================
```

### 1.3 Verificar Conectividad

**Orion-LD (Context Broker):**

```bash
curl http://localhost:1026/version

# Respuesta esperada:
{
  "orion": {
    "version": "1.5.0",
    "uptime": "0 d, 0 h, 5 m, 12 s",
    "git_hash": "nogitversion",
    "compile_time": "Mon Jan 15 09:33:42 UTC 2024",
    "compiled_by": "root",
    "compiled_in": "buildkitsandbox"
  }
}
```

**Keyrock (Identity Manager):**

```bash
curl http://localhost:3005/v1/auth/tokens \
  -H "Content-Type: application/json" \
  -d '{"name": "admin@test.com", "password": "1234"}'

# Respuesta esperada (token en el header X-Subject-Token):
{
  "token": {
    "methods": ["password"],
    "expires_at": "2025-01-15T18:00:00.000Z"
  }
}
```

---

## 🌐 Fase 2: Exponer Docker Local a Lovable Cloud (Ngrok)

### ¿Por qué Ngrok?

**Problema:** Lovable (cloud) no puede acceder a `http://localhost:1027` de tu máquina local.

**Solución:** Crear un túnel seguro con Ngrok para exponer temporalmente tu Docker local a Internet.

### 2.1 Instalar Ngrok

**macOS:**
```bash
brew install ngrok/ngrok/ngrok
```

**Linux:**
```bash
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```

**Windows:**
Descargar desde [https://ngrok.com/download](https://ngrok.com/download)

### 2.2 Configurar Cuenta (Gratis)

1. Crear cuenta en [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
2. Obtener tu Authtoken desde [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Autenticarte:

```bash
ngrok config add-authtoken <tu-token>
```

### 2.3 Exponer el PEP Proxy

```bash
# Exponer el puerto 1027 (PEP Proxy - entrada principal a FIWARE)
ngrok http 1027
```

**Salida:**

```
ngrok                                                                   

Session Status                online
Account                       tu-email@ejemplo.com (Plan: Free)
Version                       3.5.0
Region                        Europe (eu)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://a1b2-3c4d-5e6f.ngrok-free.app -> http://localhost:1027

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

### 2.4 Configurar Supabase Edge Function

**Copiar la URL generada** (en el ejemplo: `https://a1b2-3c4d-5e6f.ngrok-free.app`) y actualizar las variables de entorno en Supabase:

1. Ir a tu proyecto Lovable Cloud → Backend → Secrets
2. Actualizar la variable `FIWARE_HOST`:

```env
FIWARE_HOST=https://a1b2-3c4d-5e6f.ngrok-free.app
```

3. Guardar cambios y esperar ~30 segundos para que se apliquen.

### 2.5 Probar Conexión

Desde tu frontend de Lovable:

```typescript
import { fiwareApi } from '@/services/fiwareApi';

const testConnection = async () => {
  const response = await fiwareApi.getHealthStatus();
  console.log('FIWARE Status:', response);
};
```

**Respuesta esperada:**

```json
{
  "orion": "connected",
  "keyrock": "connected",
  "connector": "connected"
}
```

### ⚠️ Limitaciones de Ngrok (Plan Gratuito)

- **Sesión temporal**: La URL cambia cada vez que reinicias Ngrok
- **Límite de conexiones**: 40 solicitudes/minuto
- **Banner Ngrok**: El navegador puede mostrar un aviso de seguridad (normal)

**Para desarrollo serio:** Considera usar un VPS con IP estática (ver Fase 3).

---

## 🔐 Fase 3: Certificados para TRUE Connector

### ¿Por qué se necesitan certificados?

El **TRUE Connector** (componente IDS para soberanía de datos) requiere certificados SSL/TLS válidos para:
1. Autenticar la identidad del Data Space Participant
2. Cifrar la comunicación IDSCP2 (IDS Communication Protocol)

### 3.1 Certificados "Dummy" para Desarrollo

Para evitar el "infierno de Java/Keytool" durante el desarrollo, hemos pre-generado certificados autofirmados válidos por 10 años.

**Ubicación:** `./certs-dev/` (incluido en el repositorio)

```
certs-dev/
├── connector.p12        # Certificado del conector (formato PKCS12)
├── connector.crt        # Certificado público (PEM)
├── connector.key        # Clave privada (PEM)
├── truststore.jks       # Truststore Java (para verificación)
└── README.md            # Información sobre los certificados
```

**Configuración en `docker-compose.yml`:**

```yaml
services:
  true-connector-ecc:
    image: rdlabengpa/ids_execution_core_container:v1.13
    volumes:
      - ./certs-dev:/etc/cert  # Montar certificados dummy
    environment:
      - KEYSTORE_PATH=/etc/cert/connector.p12
      - KEYSTORE_PASSWORD=changeme
```

### 3.2 Generar Certificados Reales (Producción)

**Opción A: Certificado Autofirmado (Entorno de Testing)**

```bash
# Generar clave privada y certificado
openssl req -x509 -newkey rsa:4096 -keyout connector.key -out connector.crt \
  -days 3650 -nodes \
  -subj "/C=ES/ST=Madrid/L=Madrid/O=ProcureData/OU=DataSpace/CN=procuredata.connector"

# Convertir a formato PKCS12 (requerido por Java)
openssl pkcs12 -export -out connector.p12 \
  -inkey connector.key \
  -in connector.crt \
  -name connector \
  -passout pass:changeme

# Crear truststore Java
keytool -import -trustcacerts -alias connector \
  -file connector.crt \
  -keystore truststore.jks \
  -storepass changeme -noprompt
```

**Opción B: Certificado de IDS Daps (Producción Real)**

Para conectarse a espacios de datos europeos reales (Catena-X, Gaia-X, etc.), necesitas un certificado firmado por un **IDS DAPS** (Dynamic Attribute Provisioning Service).

1. Registrarte como participante en [https://internationaldataspaces.org/](https://internationaldataspaces.org/)
2. Solicitar certificado IDS a través de tu Certificate Authority (CA)
3. Actualizar `docker-compose.yml` con las rutas de los certificados reales
4. Configurar `application.properties` del TRUE Connector con el DAPS endpoint

---

## 🏭 Fase 4: Despliegue en Producción (VPS)

### 4.1 Requisitos Mínimos del Servidor

**Especificaciones:**
- **CPU**: 4 vCPUs
- **RAM**: 8 GB
- **Disco**: 50 GB SSD
- **OS**: Ubuntu 22.04 LTS
- **Red**: IP pública estática + dominio DNS

**Proveedores recomendados:**
- DigitalOcean (Droplet)
- AWS (EC2 t3.large)
- Hetzner (CX31)
- Azure (B2s)

### 4.2 Configurar Firewall

```bash
# Permitir SSH (puerto 22)
sudo ufw allow 22/tcp

# Permitir HTTPS (443) para el proxy inverso
sudo ufw allow 443/tcp

# Permitir HTTP (80) para redireccionamiento a HTTPS
sudo ufw allow 80/tcp

# Activar firewall
sudo ufw enable
```

### 4.3 Instalar Docker en el VPS

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo apt install docker-compose-plugin -y

# Añadir usuario al grupo docker (evitar sudo)
sudo usermod -aG docker $USER
newgrp docker
```

### 4.4 Clonar Repositorio y Levantar Servicios

```bash
# Clonar proyecto
git clone <tu-repo>
cd <tu-repo>

# Copiar certificados reales (si los tienes)
# cp /ruta/a/certificados/* ./certs-prod/

# Levantar stack
docker-compose up -d

# Ejecutar script de inicialización
./setup_dev_env.sh
```

### 4.5 Configurar Nginx como Reverse Proxy

**¿Por qué?** Para:
- Servir FIWARE en HTTPS (en lugar de HTTP)
- Ocultar puertos internos (1026, 3005, etc.)
- Agregar rate limiting y protección DDoS

**Instalar Nginx:**

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

**Configurar dominio:**

1. Crear registro DNS A apuntando a tu IP del VPS:
   ```
   fiware.procuredata.app → 123.45.67.89
   ```

2. Crear configuración de Nginx:

```bash
sudo nano /etc/nginx/sites-available/fiware
```

**Contenido:**

```nginx
server {
    listen 80;
    server_name fiware.procuredata.app;

    # Redirigir HTTP a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name fiware.procuredata.app;

    # Certificado SSL (generado por Certbot)
    ssl_certificate /etc/letsencrypt/live/fiware.procuredata.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fiware.procuredata.app/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Proxy al PEP-Proxy (entrada principal a FIWARE)
    location / {
        proxy_pass http://localhost:1027;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers (si es necesario)
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
        
        # Rate limiting (100 req/min por IP)
        limit_req zone=fiware_limit burst=20 nodelay;
    }
}

# Definir zona de rate limiting
limit_req_zone $binary_remote_addr zone=fiware_limit:10m rate=100r/m;
```

**Activar configuración:**

```bash
sudo ln -s /etc/nginx/sites-available/fiware /etc/nginx/sites-enabled/
sudo nginx -t  # Verificar sintaxis
sudo systemctl restart nginx
```

**Obtener certificado SSL gratuito:**

```bash
sudo certbot --nginx -d fiware.procuredata.app
```

### 4.6 Actualizar Supabase Edge Function

Cambiar `FIWARE_HOST` de la URL de Ngrok a la URL de producción:

```env
# Desarrollo (Ngrok)
FIWARE_HOST=https://a1b2-3c4d-5e6f.ngrok-free.app

# Producción (VPS)
FIWARE_HOST=https://fiware.procuredata.app
```

---

## 🔍 Troubleshooting

### Problema: "Connection refused" al llamar al proxy

**Causa:** Docker no está corriendo o los contenedores fallaron al iniciar.

**Solución:**

```bash
# Verificar estado
docker-compose ps

# Ver logs
docker-compose logs orion-ld
docker-compose logs keyrock
docker-compose logs pep-proxy

# Reiniciar servicios
docker-compose restart
```

### Problema: "FIWARE_HOST not configured" en el frontend

**Causa:** La variable de entorno no está configurada en Supabase.

**Solución:**

1. Ir a Lovable Cloud → Backend → Secrets
2. Añadir `FIWARE_HOST` con la URL correcta
3. Esperar 1 minuto para que se aplique
4. Refrescar la página del frontend

### Problema: Ngrok muestra "ERR_NGROK_8012"

**Causa:** El túnel se desconectó o la sesión expiró.

**Solución:**

```bash
# Reiniciar Ngrok
pkill ngrok
ngrok http 1027
```

### Problema: TRUE Connector no inicia (Exit Code 1)

**Causa:** Faltan certificados o el formato es incorrecto.

**Solución:**

```bash
# Verificar que existen los certificados
ls -la ./certs-dev/

# Ver logs del contenedor
docker logs true-connector-ecc

# Regenerar certificados si es necesario
./scripts/generate-certs.sh
```

---

## 📚 Recursos Adicionales

- [FIWARE Official Documentation](https://fiware.org/documentation/)
- [Ngrok Documentation](https://ngrok.com/docs)
- [TRUE Connector GitHub](https://github.com/Engineering-Research-and-Development/true-connector)
- [IDS Reference Architecture](https://internationaldataspaces.org/publications/reference-architecture-model/)
- [Smart Data Models](https://smartdatamodels.org/)

---

## ✅ Checklist de Despliegue

### Desarrollo Local
- [ ] Docker instalado y corriendo
- [ ] `docker-compose up -d` ejecutado exitosamente
- [ ] `setup_dev_env.sh` completado sin errores
- [ ] Archivo `.env.dev` generado
- [ ] Orion-LD responde en `http://localhost:1026/version`
- [ ] Keyrock responde en `http://localhost:3005`
- [ ] Ngrok instalado y autenticado
- [ ] Túnel Ngrok activo en puerto 1027
- [ ] `FIWARE_HOST` actualizado en Supabase con URL de Ngrok
- [ ] Frontend de Lovable conecta correctamente

### Producción
- [ ] VPS con Ubuntu 22.04 provisionado
- [ ] Docker y Docker Compose instalados en VPS
- [ ] Dominio DNS apuntando a IP del VPS
- [ ] Certificados SSL configurados (Let's Encrypt)
- [ ] Nginx configurado como reverse proxy
- [ ] Firewall (ufw) configurado
- [ ] `docker-compose up -d` en VPS
- [ ] `FIWARE_HOST` actualizado con URL de producción
- [ ] Certificados reales del TRUE Connector (para IDS federado)
- [ ] Monitorización configurada (opcional: Prometheus + Grafana)
