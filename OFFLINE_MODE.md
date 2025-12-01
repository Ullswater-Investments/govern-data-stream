# Modo Offline - Desarrollo sin Backend FIWARE

## 🎯 Objetivo

Permitir que los desarrolladores frontend trabajen en PROCUREDATA v2 **sin necesidad de tener Docker, FIWARE o infraestructura backend ejecutándose**. Ideal para diseñadores UI, desarrolladores frontend, o situaciones sin conexión (ej: trabajando en un tren).

---

## 🚀 Activar Modo Offline

### Opción 1: Variable de Entorno en Supabase

1. Ir a **Lovable Cloud → Backend → Secrets**
2. Añadir una nueva secret:
   ```
   USE_MOCKS=true
   ```
3. Esperar ~30 segundos para que se aplique
4. Refrescar tu aplicación Lovable

### Opción 2: Modificar Edge Function Temporalmente

En el archivo `supabase/functions/fiware-proxy/index.ts`, cambiar temporalmente:

```typescript
const USE_MOCKS = true; // Forzar modo offline
```

---

## 📊 Datos Mock Disponibles

Cuando el modo offline está activo, la Edge Function `fiware-proxy` devuelve datos simulados para los siguientes endpoints:

### 1. Versión de Orion-LD (`/version`)

```json
{
  "orion": {
    "version": "1.5.0-mock",
    "uptime": "0 d, 0 h, 0 m, 0 s (OFFLINE MODE)"
  }
}
```

### 2. Entidades NGSI-LD (`/entities`)

**Dispositivos IoT:**
```json
{
  "id": "urn:ngsi-ld:Device:mock-sensor-001",
  "type": "Device",
  "category": { "type": "Property", "value": ["sensor"] },
  "temperature": { "type": "Property", "value": 23.5, "unitCode": "CEL" },
  "batteryLevel": { "type": "Property", "value": 0.87 },
  "status": { "type": "Property", "value": "online" }
}
```

**Vehículos de Logística:**
```json
{
  "id": "urn:ngsi-ld:Vehicle:mock-vehicle-001",
  "type": "Vehicle",
  "brandName": { "type": "Property", "value": "Volvo" },
  "speed": { "type": "Property", "value": 72, "unitCode": "KMH" },
  "cargoWeight": { "type": "Property", "value": 1500, "unitCode": "KGM" },
  "location": { 
    "type": "GeoProperty", 
    "value": { "type": "Point", "coordinates": [-3.7038, 40.4168] }
  }
}
```

### 3. Operaciones de Escritura (POST/PUT/PATCH)

Cualquier operación de escritura devuelve:

```json
{
  "success": true,
  "message": "Mock entity created",
  "mode": "offline"
}
```

---

## 🧪 Uso en Componentes React

Los componentes **no necesitan cambios** para funcionar en modo offline. El servicio `fiwareApi.ts` funciona de forma transparente:

```typescript
import { fiwareApi } from '@/services/fiwareApi';

// Este código funciona tanto en modo online como offline
const MyComponent = () => {
  const { data: devices } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await fiwareApi.getDevices();
      return response.data || [];
    }
  });

  return (
    <div>
      {devices?.map(device => (
        <div key={device.id}>{device.id}</div>
      ))}
    </div>
  );
};
```

**Resultado:**
- **Modo Online:** Devuelve datos reales de Orion-LD
- **Modo Offline:** Devuelve `mock-sensor-001` y `mock-vehicle-001`

---

## 🎨 Ventajas del Modo Offline

1. **Desarrollo Independiente:** Los diseñadores UI pueden trabajar sin esperar al equipo de backend
2. **Sin Infraestructura:** No necesitas Docker, VPS, ni ningún servidor corriendo
3. **Prototipado Rápido:** Prueba flujos de UI sin configurar FIWARE
4. **Desarrollo sin Internet:** Trabaja en un avión, tren o café sin WiFi
5. **Onboarding Fácil:** Nuevos desarrolladores pueden empezar en minutos

---

## 🔍 Detectar Modo Offline en la UI

Puedes añadir un badge visual para informar al usuario que está en modo offline:

```typescript
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { fiwareApi } from '@/services/fiwareApi';

export const OfflineBadge = () => {
  const { data: status } = useQuery({
    queryKey: ['fiware-status'],
    queryFn: () => fiwareApi.getHealthStatus()
  });

  // Si la versión contiene "mock", estamos offline
  const isOffline = status?.orion?.version?.includes('mock');

  if (!isOffline) return null;

  return (
    <Badge variant="secondary" className="gap-2">
      <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
      Modo Offline
    </Badge>
  );
};
```

---

## 🔄 Cambiar Entre Modo Offline y Online

### Desactivar Modo Offline

1. Ir a **Lovable Cloud → Backend → Secrets**
2. Cambiar `USE_MOCKS=false` (o eliminar la variable)
3. Asegurarse de que `FIWARE_HOST` está configurado con tu URL real

### Verificar Estado Actual

```bash
# Desde la terminal o navegador
curl https://yourapp.lovable.app/fiware-proxy -X POST \
  -H "Content-Type: application/json" \
  -d '{"path": "/version", "method": "GET"}'

# Si devuelve "1.5.0-mock", estás en offline mode
# Si devuelve "1.5.0" (sin mock), estás en online mode
```

---

## ⚙️ Añadir Tus Propios Mocks

Para personalizar los datos mock según tu caso de uso:

1. Editar `supabase/functions/fiware-proxy/index.ts`
2. Modificar el objeto `MOCK_DATA`:

```typescript
const MOCK_DATA = {
  entities: [
    {
      id: 'urn:ngsi-ld:Machine:mock-machine-001',
      type: 'Machine',
      name: { type: 'Property', value: 'Torno CNC Industrial' },
      operatingHours: { type: 'Property', value: 1250 },
      maintenanceStatus: { type: 'Property', value: 'operational' }
    }
  ]
};
```

3. Guardar y redesplegar la Edge Function

---

## 🚨 Limitaciones del Modo Offline

1. **No Persiste Datos:** Las operaciones POST/PUT no guardan datos realmente
2. **Sincronización:** Los datos mock no se sincronizan con Orion-LD
3. **Relaciones:** No se pueden probar relaciones complejas entre entidades
4. **Autenticación:** Keyrock (IDM) no está disponible en modo offline

**Recomendación:** Usa modo offline para UI/UX y pruebas visuales. Para testing de integración, usa el entorno Docker real.

---

## 📚 Flujo de Trabajo Recomendado

### Etapa 1: Diseño y Prototipado (Modo Offline)
- Desarrolladores frontend diseñan la UI
- Prueban flujos de usuario con datos mock
- Validan diseños sin dependencias de backend

### Etapa 2: Integración (Modo Online con Ngrok)
- Levantar Docker local con `docker-compose up -d`
- Ejecutar `./setup_dev_env.sh`
- Exponer con Ngrok: `ngrok http 1027`
- Configurar `FIWARE_HOST` en Supabase con URL de Ngrok
- Desactivar `USE_MOCKS`

### Etapa 3: Testing (Modo Online con VPS)
- Desplegar FIWARE en VPS de staging
- Configurar `FIWARE_HOST` con dominio real
- Tests E2E con datos reales

### Etapa 4: Producción
- VPS con certificados SSL
- Dominio propio
- `USE_MOCKS=false` permanente

---

## 🔗 Referencias

- [Guía de Desarrollo Local](./DEVELOPER_GUIDE.md#0-configuración-rápida-del-entorno-de-desarrollo)
- [Arquitectura del Proxy](./ARCHITECTURE_V2.md#proxy-fiware)
- [Esquemas de Validación](./src/schemas/fiwareSchemas.ts)

---

**Tip:** Combina modo offline con las funciones de adaptador `simplifyEntity()` y los esquemas Zod para una experiencia de desarrollo fluida y segura.
