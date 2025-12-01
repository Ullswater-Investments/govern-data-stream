# PROCUREDATA v2 - JSON-LD Contexts

Este directorio contiene los archivos de contexto JSON-LD que definen el vocabulario semántico compartido de PROCUREDATA.

## 📄 Archivos

### `procuredata-context.jsonld`

Contexto maestro que incluye:

- **Logística y Transporte**: Modelos de vehículos, órdenes de entrega, peso de carga
- **Manufactura e IoT**: Dispositivos industriales, máquinas, sensores de vibración
- **Modelos de Negocio**: Activos de datos, políticas de uso, niveles de acceso

**URL pública:** `https://yourapp.lovable.app/contexts/procuredata-context.jsonld`

## 🌐 Interoperabilidad

Este contexto está alineado con:

- **ETSI NGSI-LD**: Estándar europeo para Context Information Management
- **Smart Data Models**: Repositorio oficial de modelos de datos armonizados
- **IDS Reference Architecture**: Marco de International Data Spaces Association
- **Schema.org**: Vocabulario universal de la web semántica

## 🔄 Uso Automático

El servicio `fiwareApi.ts` incluye automáticamente este contexto en todas las entidades NGSI-LD que se crean. No necesitas especificarlo manualmente.

```typescript
import { fiwareApi, toNgsiEntity } from '@/services/fiwareApi';

// El contexto se añade automáticamente
const device = toNgsiEntity({
  temperature: 24.5,
  batteryLevel: 0.85
}, "Device");

await fiwareApi.createEntity(device);
```

## 📝 Personalización

Para añadir términos personalizados:

1. Edita `procuredata-context.jsonld`
2. Añade tus definiciones siguiendo el formato:
   ```json
   {
     "@context": {
       "tuTermino": "https://tudominio.com/dataModel/tuTermino"
     }
   }
   ```
3. Despliega la aplicación (los cambios se aplican automáticamente)

## 🔍 Validación

Para verificar que el contexto está funcionando:

```bash
# Desde tu navegador o terminal
curl https://yourapp.lovable.app/contexts/procuredata-context.jsonld

# Debería devolver el JSON-LD completo
```

## 📚 Referencias

- [NGSI-LD Specification](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.08.01_60/gs_CIM009v010801p.pdf)
- [Smart Data Models](https://smartdatamodels.org/)
- [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/)
- [IDS Information Model](https://github.com/International-Data-Spaces-Association/InformationModel)

---

**Nota:** Este contexto es público y accesible sin autenticación. Es necesario para que otros participantes del espacio de datos puedan interpretar tus entidades NGSI-LD correctamente.
