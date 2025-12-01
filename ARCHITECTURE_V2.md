# Informe de Arquitectura - PROCUREDATA v2
## Espacio de Datos Industrial con FIWARE + Kubernetes

**Versión**: 2.0  
**Fecha**: Diciembre 2024  
**Autor**: Equipo de Arquitectura PROCUREDATA  
**Estado**: Producción-Ready

---

## 📋 Executive Summary

PROCUREDATA v2 implementa una arquitectura **híbrida de 3 capas** para gestionar el ciclo de vida completo de transacciones de datos industriales bajo el marco de **soberanía de datos IDS** (International Data Spaces):

1. **Capa de Presentación**: Frontend React/Vite desplegado en Lovable
2. **Capa de Lógica de Negocio**: Supabase (PostgreSQL + Edge Functions)
3. **Capa de Contexto en Tiempo Real**: FIWARE (Orion-LD + Keyrock + TRUE Connector) en Kubernetes

Esta separación de responsabilidades garantiza:
- ✅ **Escalabilidad**: Cada capa escala independientemente
- ✅ **Seguridad**: Credenciales FIWARE nunca expuestas al navegador
- ✅ **Interoperabilidad**: Compatibilidad con estándares NGSI-LD y ODRL 2.0

---

## 🏗️ 1. Arquitectura de Base de Datos Híbrida

### 1.1 Principio de Separación de Responsabilidades

La arquitectura utiliza **3 bases de datos especializadas**, cada una optimizada para su caso de uso:

```
┌─────────────────────────────────────────────────────────────────┐
│                       CAPA DE APLICACIÓN                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │        PostgreSQL (Supabase)                            │   │
│  │  • Usuarios, Perfiles, Organizaciones                   │   │
│  │  • Transacciones históricas (data_transactions)         │   │
│  │  • Catálogo de activos (data_assets)                    │   │
│  │  • Estado UI (preferencias, roles)                      │   │
│  │  Persistencia: SSD, Backups diarios                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   CAPA DE CONTEXTO EN TIEMPO REAL               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │        MongoDB (Orion-LD)                               │   │
│  │  • Gemelos Digitales (Digital Twins)                    │   │
│  │  • Entidades NGSI-LD (Devices, Sensors, Buildings)     │   │
│  │  • Estado actual de activos físicos                    │   │
│  │  • Suscripciones y notificaciones                      │   │
│  │  Persistencia: Réplicas 3x, WiredTiger Cache 1.5GB    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     CAPA DE IDENTIDAD Y ACCESO                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │        MySQL (Keyrock)                                  │   │
│  │  • Credenciales OAuth2 (Client ID/Secret)              │   │
│  │  • Tokens de acceso (X-Subject-Token)                  │   │
│  │  • Políticas XACML (permisos granulares)               │   │
│  │  • Aplicaciones registradas                            │   │
│  │  Persistencia: Master-Replica, Logs binarios          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Justificación de la Separación

#### PostgreSQL (Supabase) - "El Registro Oficial"
- **Propósito**: Datos estructurados de negocio con integridad ACID
- **Casos de uso**:
  - Auditoría de transacciones (quién, cuándo, qué)
  - Relaciones entre organizaciones (RBAC)
  - Metadata de activos (descripción, tipo, propietario)
- **Ventajas**:
  - Foreign Keys para garantizar consistencia
  - RLS (Row Level Security) integrado
  - Backups point-in-time automáticos
- **Acceso**: Directo desde frontend vía Supabase SDK

#### MongoDB (Orion-LD) - "El Cerebro en Tiempo Real"
- **Propósito**: Estado dinámico y mutable de activos físicos
- **Casos de uso**:
  - Temperatura actual de un sensor: `23.5°C → 24.1°C` (cada 5s)
  - Ubicación GPS de un vehículo: actualización continua
  - Agregaciones geoespaciales: sensores en radio de 5km
- **Ventajas**:
  - Esquema flexible (JSON-like documents)
  - Queries geoespaciales nativas
  - Alta escritura concurrente
- **Acceso**: **Solo** vía Edge Function `fiware-proxy` (nunca directo)

#### MySQL (Keyrock) - "El Guardián"
- **Propósito**: Gestión de identidades y tokens OAuth2
- **Casos de uso**:
  - Generar tokens de sesión para usuarios
  - Validar permisos de aplicaciones externas
  - Federación de identidades (SSO con otros espacios de datos)
- **Ventajas**:
  - Estándar en FIWARE (amplia compatibilidad)
  - Integración nativa con PEP-Proxy
- **Acceso**: Interno, gestionado por Keyrock API

### 1.3 Flujo de Datos Completo

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend (Lovable)
    participant SB as Supabase (PostgreSQL)
    participant EF as Edge Function
    participant K as Keyrock (MySQL)
    participant O as Orion-LD (MongoDB)

    Note over U,F: 1. Usuario inicia transacción
    U->>F: Solicita acceso a "IoT Dataset"
    F->>SB: INSERT INTO data_transactions (...)
    SB-->>F: Transaction ID: abc-123
    
    Note over F,EF: 2. Frontend consulta estado en tiempo real
    F->>EF: invoke('fiware-proxy', { path: '/entities' })
    EF->>K: POST /v1/auth/tokens
    K-->>EF: X-Subject-Token: xyz-789
    EF->>O: GET /entities (+ Token)
    O-->>EF: [Device entities con temperatura actual]
    EF-->>F: Datos normalizados
    
    Note over F,SB: 3. Frontend actualiza UI y Postgres
    F->>F: Renderiza dashboard con datos vivos
    F->>SB: UPDATE data_transactions SET status='approved'
```

### 1.4 Política de Sincronización

**Regla de Oro**: PostgreSQL es la **fuente de verdad** para transacciones históricas. MongoDB es la **fuente de verdad** para estado actual.

| Evento | Acción en PostgreSQL | Acción en MongoDB |
|--------|---------------------|-------------------|
| Nueva transacción creada | `INSERT INTO data_transactions` | *(Ninguna)* |
| Transacción aprobada | `UPDATE status='approved'` | *(Ninguna)* |
| Data asset compartido | `INSERT INTO data_assets` | `POST /ngsi-ld/v1/entities` (crear DataAsset entity) |
| Sensor reporta nuevo valor | *(Ninguna)* | `PATCH /entities/{id}/attrs` (actualizar temperatura) |
| Transacción completada | `UPDATE status='completed'` | `POST /subscriptions` (notificar a consumidor) |

**Anti-Patrón**: ❌ Nunca duplicar datos estáticos (ej: nombre de organización) en MongoDB. Usa `Relationship` para referenciar.

---

## 🚀 2. Estrategia de Despliegue en Kubernetes

### 2.1 Ventajas de Migrar a Kubernetes

El `docker-compose.yml` actual es ideal para desarrollo, pero producción requiere:

| Problema en Docker Compose | Solución en Kubernetes |
|-----------------------------|------------------------|
| Reinicio manual tras fallos | `restartPolicy: Always` automático |
| Escalado manual (1 réplica) | `HorizontalPodAutoscaler` (2-10 réplicas) |
| Sin balanceo de carga interno | `Service` tipo `ClusterIP` con load balancer |
| Actualizaciones con downtime | `RollingUpdate` sin interrupciones |
| Secretos en texto plano | `Secrets` encriptados con etcd |

### 2.2 Arquitectura de Pods Propuesta

```
┌──────────────────────────────────────────────────────────────┐
│                      NAMESPACE: fiware-prod                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  StatefulSet    │    │  StatefulSet    │                │
│  │  mongo-orion    │    │  mysql-keyrock  │                │
│  │  (3 replicas)   │    │  (2 replicas)   │                │
│  │  PVC: 50Gi SSD  │    │  PVC: 20Gi SSD  │                │
│  └─────────────────┘    └─────────────────┘                │
│                                                              │
│  ┌─────────────────────────────────────────┐                │
│  │  Deployment: orion-ld (4 replicas)      │                │
│  │  Resources: CPU 500m, RAM 1Gi           │                │
│  │  Env: DBHOST=mongo-orion-service        │                │
│  └─────────────────────────────────────────┘                │
│                                                              │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │  Deployment:     │    │  Deployment:     │              │
│  │  keyrock         │    │  pep-proxy       │              │
│  │  (2 replicas)    │    │  (3 replicas)    │              │
│  │  Port: 3005      │    │  Port: 1027      │              │
│  └──────────────────┘    └──────────────────┘              │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │  Deployment: true-connector              │               │
│  │  Pods: ecc + data-app (sidecar pattern) │               │
│  │  Resources: CPU 1000m, RAM 2Gi           │               │
│  │  PVC: 10Gi para certificados IDS         │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
│  ┌──────────────────────────────────────────┐               │
│  │  Ingress: nginx-ingress-controller       │               │
│  │  TLS: cert-manager (Let's Encrypt)       │               │
│  │  Routes:                                 │               │
│  │    /orion →     Service: pep-proxy:1027  │               │
│  │    /keyrock →   Service: keyrock:3005    │               │
│  │    /connector → Service: true-ecc:8080   │               │
│  └──────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 Manifests de Kubernetes (Ejemplo: Orion-LD)

#### StatefulSet para MongoDB

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongo-orion
  namespace: fiware-prod
spec:
  serviceName: mongo-orion-service
  replicas: 3
  selector:
    matchLabels:
      app: mongo-orion
  template:
    metadata:
      labels:
        app: mongo-orion
    spec:
      containers:
      - name: mongo
        image: mongo:4.4
        command:
          - mongod
          - --wiredTigerCacheSizeGB
          - "1.5"
          - --nojournal
          - --replSet
          - rs0
        ports:
        - containerPort: 27017
        volumeMounts:
        - name: mongo-data
          mountPath: /data/db
        resources:
          requests:
            cpu: 500m
            memory: 2Gi
          limits:
            cpu: 2000m
            memory: 4Gi
  volumeClaimTemplates:
  - metadata:
      name: mongo-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 50Gi
```

#### Deployment para Orion-LD

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orion-ld
  namespace: fiware-prod
spec:
  replicas: 4
  selector:
    matchLabels:
      app: orion-ld
  template:
    metadata:
      labels:
        app: orion-ld
    spec:
      containers:
      - name: orion
        image: fiware/orion-ld:latest
        args:
          - -dbhost
          - mongo-orion-service
          - -logLevel
          - WARN
          - -forwarding
          - "true"
        ports:
        - containerPort: 1026
        livenessProbe:
          httpGet:
            path: /version
            port: 1026
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /version
            port: 1026
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 1000m
            memory: 2Gi
```

### 2.4 Ingress Controller con TLS

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fiware-ingress
  namespace: fiware-prod
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
spec:
  tls:
  - hosts:
    - api.procuredata.com
    secretName: fiware-tls-secret
  rules:
  - host: api.procuredata.com
    http:
      paths:
      - path: /orion
        pathType: Prefix
        backend:
          service:
            name: pep-proxy-service
            port:
              number: 1027
      - path: /keyrock
        pathType: Prefix
        backend:
          service:
            name: keyrock-service
            port:
              number: 3005
      - path: /connector
        pathType: Prefix
        backend:
          service:
            name: true-ecc-service
            port:
              number: 8080
```

### 2.5 HorizontalPodAutoscaler (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: orion-ld-hpa
  namespace: fiware-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orion-ld
  minReplicas: 4
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Comportamiento**: Si la CPU promedio supera 70%, K8s escala de 4 a 10 réplicas automáticamente.

---

## 🔄 3. Flujo de Datos Completo (Producción)

```
┌────────────────┐
│ Usuario Final  │
│ (Navegador)    │
└───────┬────────┘
        │ HTTPS
        ▼
┌────────────────────────┐
│ Lovable (Frontend)     │
│ React + Vite           │
└───────┬────────────────┘
        │ HTTPS (Supabase Auth)
        ▼
┌────────────────────────────────────┐
│ Supabase Edge Function (Proxy)    │
│ • Cache de tokens (1h TTL)         │
│ • Inyecta X-Auth-Token             │
│ • Normaliza NGSI-LD → JSON plano   │
└───────┬────────────────────────────┘
        │ HTTPS
        ▼
┌────────────────────────────────────┐
│ Ingress Controller (K8s)           │
│ • SSL/TLS Termination              │
│ • Rate Limiting (1000 req/min)     │
│ • Load Balancing (Round-robin)     │
└───────┬────────────────────────────┘
        │ HTTP (cluster interno)
        ▼
┌────────────────────────────────────┐
│ Service: pep-proxy (ClusterIP)    │
│ • Endpoints: [pod1, pod2, pod3]    │
└───────┬────────────────────────────┘
        │
        ▼
┌────────────────────────────────────┐
│ PEP-Proxy Pods (3 réplicas)        │
│ • Valida X-Auth-Token con Keyrock  │
│ • Enforce políticas XACML          │
└───────┬────────────────────────────┘
        │
        ▼
┌────────────────────────────────────┐
│ Service: orion-ld (ClusterIP)      │
│ • Endpoints: [pod1, pod2, pod3...] │
└───────┬────────────────────────────┘
        │
        ▼
┌────────────────────────────────────┐
│ Orion-LD Pods (4-10 réplicas)      │
│ • Ejecuta query NGSI-LD            │
│ • Lee/escribe en MongoDB           │
└───────┬────────────────────────────┘
        │
        ▼
┌────────────────────────────────────┐
│ StatefulSet: MongoDB (3 réplicas)  │
│ • Replica Set con leader election  │
│ • Persistencia: PVC 50Gi SSD       │
└────────────────────────────────────┘
```

### 3.1 Ejemplo de Latencia End-to-End

| Paso | Componente | Latencia |
|------|-----------|----------|
| 1 | Browser → Lovable | 50ms (CDN) |
| 2 | Lovable → Supabase (Edge Fn) | 20ms |
| 3 | Edge Fn → Keyrock (token cache) | 0ms (cached) |
| 4 | Edge Fn → Ingress K8s | 30ms |
| 5 | Ingress → PEP-Proxy | 5ms |
| 6 | PEP-Proxy → Orion-LD | 10ms |
| 7 | Orion-LD → MongoDB | 15ms |
| **Total** | | **130ms** |

**Optimizaciones aplicadas**:
- ✅ Token cacheado (ahorra 50ms vs. Keyrock cada vez)
- ✅ Réplicas de Orion-LD (reduce latencia bajo carga)
- ✅ MongoDB indexes en `id` y `type` (queries rápidas)

---

## 🔒 4. Seguridad en Profundidad (Defense in Depth)

### 4.1 Capa de Red (Network Policies)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: orion-ld-policy
  namespace: fiware-prod
spec:
  podSelector:
    matchLabels:
      app: orion-ld
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: pep-proxy  # Solo PEP-Proxy puede conectar a Orion
    ports:
    - protocol: TCP
      port: 1026
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: mongo-orion  # Solo puede hablar con MongoDB
    ports:
    - protocol: TCP
      port: 27017
```

**Resultado**: Orion-LD está **aislado**. Ni siquiera otros pods del namespace pueden conectar.

### 4.2 Gestión de Secretos

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: keyrock-db-credentials
  namespace: fiware-prod
type: Opaque
stringData:
  MYSQL_ROOT_PASSWORD: "$(openssl rand -base64 32)"  # Generado dinámicamente
  MYSQL_PASSWORD: "$(openssl rand -base64 32)"
```

**Ventajas vs. docker-compose**:
- ✅ Secretos encriptados en `etcd` (K8s control plane)
- ✅ Rotación automática con `cert-manager`
- ✅ RBAC: Solo el pod `keyrock` puede leer este secret

### 4.3 Auditoría de Accesos

**Herramientas recomendadas**:
- **Falco**: Detecta comportamientos anómalos (ej: pod ejecutando `curl` inesperado)
- **Open Policy Agent (OPA)**: Políticas de admisión (ej: "No pods privilegiados")
- **Loki**: Centraliza logs de todos los pods

Ejemplo de alerta Falco:
```yaml
- rule: Unauthorized Access to MongoDB
  desc: Detectar conexiones a MongoDB desde pods no autorizados
  condition: >
    connection_made and
    container.image.repository != "fiware/orion-ld" and
    fd.sip = "mongo-orion-service"
  output: "Conexión sospechosa a MongoDB (pod=%container.name ip=%fd.cip)"
  priority: CRITICAL
```

---

## 📊 5. Monitoreo y Observabilidad

### 5.1 Stack Recomendado: Prometheus + Grafana

```yaml
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: orion-ld-monitor
  namespace: fiware-prod
spec:
  selector:
    matchLabels:
      app: orion-ld
  endpoints:
  - port: metrics
    interval: 30s
```

**Métricas clave a monitorear**:

| Métrica | Alerta si... |
|---------|--------------|
| `orion_entities_total` | < 1000 (dataset vacío) |
| `orion_query_latency_p99` | > 500ms (slow queries) |
| `pep_proxy_401_errors` | > 10/min (auth issues) |
| `mongo_replica_lag_seconds` | > 10s (replicación lenta) |
| `keyrock_token_generation_rate` | > 1000/min (posible DDoS) |

### 5.2 Dashboards Grafana Predefinidos

**Dashboard 1: Context Broker Health**
```json
{
  "panels": [
    {
      "title": "Entidades NGSI-LD por Tipo",
      "targets": [
        {
          "expr": "sum by (type) (orion_entities_total)",
          "legendFormat": "{{ type }}"
        }
      ]
    },
    {
      "title": "Latencia de Queries (P50, P95, P99)",
      "targets": [
        {
          "expr": "histogram_quantile(0.99, orion_query_duration_seconds_bucket)"
        }
      ]
    }
  ]
}
```

**Dashboard 2: TRUE Connector (IDS)**
- Contratos activos (`true_connector_contracts_active`)
- Datos transferidos a otros espacios (`true_connector_bytes_transferred`)
- Validaciones DAPS exitosas/fallidas

---

## 🧪 6. Testing y CI/CD

### 6.1 Pipeline GitOps (ArgoCD)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: fiware-stack
  namespace: argocd
spec:
  project: production
  source:
    repoURL: https://github.com/procuredata/fiware-k8s
    targetRevision: main
    path: manifests/production
  destination:
    server: https://kubernetes.default.svc
    namespace: fiware-prod
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

**Flujo**:
1. Dev hace `git push` a `fiware-k8s/manifests/production/orion-deployment.yaml`
2. ArgoCD detecta cambio (polling cada 3min)
3. Aplica cambios a K8s con estrategia `RollingUpdate`
4. Si falla, rollback automático al commit anterior

### 6.2 Tests de Integración (Ejemplo: Orion-LD)

```python
import requests

def test_orion_ngsi_ld_compliance():
    """Verifica que Orion responda según ETSI spec"""
    base_url = "https://api.procuredata.com/orion"
    
    # Test: Crear entidad
    entity = {
        "id": "urn:ngsi-ld:Test:001",
        "type": "TestEntity",
        "value": {"type": "Property", "value": 42}
    }
    r = requests.post(f"{base_url}/ngsi-ld/v1/entities", json=entity)
    assert r.status_code == 201
    
    # Test: Recuperar entidad
    r = requests.get(f"{base_url}/ngsi-ld/v1/entities/urn:ngsi-ld:Test:001")
    assert r.status_code == 200
    assert r.json()["value"]["value"] == 42
    
    # Test: Eliminar entidad
    r = requests.delete(f"{base_url}/ngsi-ld/v1/entities/urn:ngsi-ld:Test:001")
    assert r.status_code == 204
```

---

## 🔮 7. Roadmap de Evolución

### Fase Actual (v2.0): Kubernetes Monolítico
- Todos los componentes FIWARE en un clúster
- Escalado manual (HPA configurado)
- Backups diarios

### v2.5 (Q2 2025): Multi-Region
- Orion-LD replicado en 3 regiones (EU, US, APAC)
- MongoDB global cluster (latencia < 50ms)
- Keyrock federado (SSO entre regiones)

### v3.0 (Q4 2025): Service Mesh (Istio)
- Telemetría automática (traces, spans)
- Circuit breakers (fallback si TRUE Connector falla)
- mTLS entre todos los pods (zero-trust)

### v3.5 (2026): Edge Computing
- Orion-LD Lite en dispositivos IoT (ARM64)
- Sincronización bidireccional con cluster central
- 5G network slicing para latencia ultra-baja

---

## 📚 8. Anexos

### 8.1 Glosario

| Término | Definición |
|---------|------------|
| **NGSI-LD** | Next Generation Service Interface - Linked Data (estándar ETSI) |
| **ODRL** | Open Digital Rights Language (políticas de uso de datos) |
| **IDS** | International Data Spaces (arquitectura de soberanía) |
| **PEP** | Policy Enforcement Point (valida permisos) |
| **DAPS** | Dynamic Attribute Provisioning Service (CA de certificados IDS) |
| **Gemelo Digital** | Representación virtual de un objeto físico (ISO 23247) |

### 8.2 Comparativa: Docker vs. Kubernetes

| Aspecto | Docker Compose | Kubernetes |
|---------|---------------|-----------|
| Despliegue inicial | 5 min | 30 min (incluye cluster setup) |
| Escalado | Manual | Automático (HPA) |
| Alta disponibilidad | ❌ Single host | ✅ Multi-nodo |
| Actualizaciones | Downtime necesario | Rolling updates sin downtime |
| Costo operativo | Bajo (1 servidor) | Medio-Alto (3+ nodos) |
| **Recomendado para** | Dev/Testing | Producción |

### 8.3 Costos Estimados (AWS EKS)

| Recurso | Cantidad | Costo Mensual (USD) |
|---------|----------|---------------------|
| EKS Control Plane | 1 | $73 |
| Worker Nodes (t3.xlarge) | 3 | $300 |
| MongoDB PVC (gp3 SSD) | 150Gi | $15 |
| MySQL PVC (gp3 SSD) | 60Gi | $6 |
| Application Load Balancer | 1 | $23 |
| Data Transfer (outbound) | 500GB | $45 |
| **TOTAL** | | **~$462/mes** |

**Optimización**: Usar Spot Instances para Orion-LD (-70% costo) → **$270/mes**

---

## 🆘 Contacto y Soporte

**Equipo de Arquitectura**:
- Email: arquitectura@procuredata.com
- Slack: `#fiware-architecture`
- Docs: https://docs.procuredata.com

**Incidentes críticos**:
- On-call: +34 XXX XXX XXX (24/7)
- PagerDuty: https://procuredata.pagerduty.com

---

**Versión del Documento**: 2.0  
**Última Actualización**: Diciembre 2024  
**Próxima Revisión**: Marzo 2025  

**Aprobado por**:
- [ ] CTO
- [ ] Arquitecto de Seguridad
- [ ] Lead DevOps Engineer
