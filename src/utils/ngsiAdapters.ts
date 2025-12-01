/**
 * NGSI-LD Adapter Utilities
 * 
 * Estas funciones simplifican la interacción del frontend con el formato NGSI-LD
 * complejo de FIWARE, permitiendo a los desarrolladores trabajar con objetos JSON planos.
 * 
 * Patrón "Adapter": Convierte estructuras complejas en interfaces simples.
 */

/**
 * Interfaz para entidades NGSI-LD crudas
 */
export interface NgsiProperty {
  type: 'Property' | 'Relationship' | 'GeoProperty';
  value: any;
  observedAt?: string;
  unitCode?: string;
  metadata?: Record<string, any>;
}

export interface NgsiEntity {
  id: string;
  type: string;
  '@context'?: string | string[];
  [key: string]: string | NgsiProperty | string[] | undefined;
}

/**
 * Entidad simplificada para uso en la UI
 */
export interface SimpleEntity {
  id: string;
  type: string;
  [key: string]: any;
}

/**
 * Convierte una entidad NGSI-LD compleja en un objeto JSON plano
 * 
 * @example
 * // Input (FIWARE crudo):
 * {
 *   "id": "urn:ngsi-ld:Device:001",
 *   "type": "Device",
 *   "temperature": { "type": "Property", "value": 23, "unitCode": "CEL" },
 *   "location": { "type": "GeoProperty", "value": { "type": "Point", "coordinates": [40, -3] } }
 * }
 * 
 * // Output (UI amigable):
 * {
 *   "id": "urn:ngsi-ld:Device:001",
 *   "type": "Device",
 *   "temperature": 23,
 *   "location": { "type": "Point", "coordinates": [40, -3] }
 * }
 */
export const simplifyEntity = (entity: NgsiEntity): SimpleEntity => {
  const simple: SimpleEntity = { 
    id: entity.id, 
    type: entity.type 
  };

  Object.keys(entity).forEach(key => {
    // Ignorar campos de metadatos NGSI-LD
    if (key === 'id' || key === 'type' || key === '@context') {
      return;
    }

    const prop = entity[key];
    
    // Si es un objeto con estructura NGSI-LD Property/Relationship
    if (prop && typeof prop === 'object' && 'value' in prop) {
      simple[key] = (prop as NgsiProperty).value;
    } else {
      // Pasar directamente (para casos de atributos no estándar)
      simple[key] = prop;
    }
  });

  return simple;
};

/**
 * Convierte un array de entidades NGSI-LD en objetos simples
 * 
 * @example
 * const devices = await fiwareApi.getDevices();
 * const simpleDevices = simplifyEntities(devices.data || []);
 * // Ahora puedes usar: simpleDevices[0].temperature directamente
 */
export const simplifyEntities = (entities: NgsiEntity[]): SimpleEntity[] => {
  return entities.map(simplifyEntity);
};

/**
 * Convierte un objeto JSON plano en una entidad NGSI-LD válida
 * 
 * Incluye automáticamente el contexto PROCUREDATA para interoperabilidad semántica
 * 
 * @example
 * const simple = { name: "Sensor01", temperature: 25, status: "active" };
 * const ngsi = toNgsiEntity(simple, "Device", "urn:ngsi-ld:Device:sensor01");
 * 
 * // Resultado:
 * {
 *   "id": "urn:ngsi-ld:Device:sensor01",
 *   "type": "Device",
 *   "@context": ["https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld", 
 *                "https://yourapp.lovable.app/contexts/procuredata-context.jsonld"],
 *   "name": { "type": "Property", "value": "Sensor01" },
 *   "temperature": { "type": "Property", "value": 25 },
 *   "status": { "type": "Property", "value": "active" }
 * }
 */
export const toNgsiEntity = (
  data: Record<string, any>, 
  type: string, 
  id?: string
): NgsiEntity => {
  const contextUrl = `${window.location.origin}/contexts/procuredata-context.jsonld`;
  
  const entity: NgsiEntity = {
    id: id || `urn:ngsi-ld:${type}:${Date.now()}`,
    type,
    '@context': [
      'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld',
      contextUrl
    ]
  };

  Object.keys(data).forEach(key => {
    const value = data[key];
    
    // Detectar GeoProperties (objetos con type: "Point", etc.)
    if (value && typeof value === 'object' && value.type === 'Point') {
      entity[key] = {
        type: 'GeoProperty',
        value
      };
    } else {
      entity[key] = {
        type: 'Property',
        value
      };
    }
  });

  return entity;
};

/**
 * Extrae el valor de un Property NGSI-LD de forma segura
 * 
 * @example
 * const temp = extractValue(entity.temperature, 0); // Devuelve 0 si no existe
 */
export const extractValue = <T = any>(prop: NgsiProperty | any, defaultValue?: T): T => {
  if (!prop) return defaultValue as T;
  if (typeof prop === 'object' && 'value' in prop) {
    return prop.value;
  }
  return prop;
};

/**
 * Valida si un objeto es una entidad NGSI-LD válida
 */
export const isValidNgsiEntity = (obj: any): obj is NgsiEntity => {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    obj.id.startsWith('urn:ngsi-ld:')
  );
};

/**
 * Formatea un URN de NGSI-LD para mostrar en la UI
 * 
 * @example
 * formatEntityId("urn:ngsi-ld:Device:sensor-temp-001") 
 * // → "sensor-temp-001"
 */
export const formatEntityId = (urn: string): string => {
  const parts = urn.split(':');
  return parts[parts.length - 1];
};
