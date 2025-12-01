import { z } from "zod";

/**
 * FIWARE Validation Schemas
 * 
 * Esquemas Zod para validar datos antes de enviarlos a Orion-LD.
 * Previene errores 400 Bad Request y asegura la integridad de los datos.
 */

// URN NGSI-LD válido
const urnPattern = /^urn:ngsi-ld:[A-Za-z]+:[A-Za-z0-9_-]+$/;

export const UrnSchema = z.string().regex(urnPattern, {
  message: "URN debe seguir el formato: urn:ngsi-ld:Type:id"
});

/**
 * Schema para Dispositivos IoT (Smart Data Models - Device)
 */
export const DeviceSchema = z.object({
  id: UrnSchema.optional(),
  serialNumber: z.string()
    .min(5, "El número de serie debe tener al menos 5 caracteres")
    .max(50, "El número de serie no puede exceder 50 caracteres"),
  category: z.array(z.enum(["sensor", "actuator", "meter", "gateway"]))
    .min(1, "Selecciona al menos una categoría"),
  temperature: z.number()
    .min(-50, "Temperatura mínima: -50°C")
    .max(100, "Temperatura máxima: 100°C")
    .optional(),
  batteryLevel: z.number()
    .min(0, "Nivel de batería debe ser entre 0 y 1")
    .max(1, "Nivel de batería debe ser entre 0 y 1")
    .optional(),
  rssi: z.number()
    .min(-120, "RSSI mínimo: -120 dBm")
    .max(0, "RSSI máximo: 0 dBm")
    .optional(),
  status: z.enum(["online", "offline", "maintenance", "error"]).default("online"),
  maintenanceStatus: z.enum(["ok", "warning", "critical"]).default("ok")
});

export type DeviceFormData = z.infer<typeof DeviceSchema>;

/**
 * Schema para Vehículos (Smart Data Models - Vehicle)
 */
export const VehicleSchema = z.object({
  id: UrnSchema.optional(),
  brandName: z.string()
    .min(2, "Marca debe tener al menos 2 caracteres")
    .max(50, "Marca no puede exceder 50 caracteres"),
  fleetVehicleId: z.string()
    .min(3, "ID de flota debe tener al menos 3 caracteres")
    .max(30, "ID de flota no puede exceder 30 caracteres"),
  speed: z.number()
    .min(0, "Velocidad no puede ser negativa")
    .max(200, "Velocidad máxima: 200 km/h")
    .optional(),
  cargoWeight: z.number()
    .min(0, "Peso de carga no puede ser negativo")
    .max(50000, "Peso de carga máximo: 50,000 kg")
    .optional(),
  location: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([
      z.number().min(-180).max(180), // longitude
      z.number().min(-90).max(90)    // latitude
    ])
  }).optional()
});

export type VehicleFormData = z.infer<typeof VehicleSchema>;

/**
 * Schema para Máquinas (Smart Data Models - Machine)
 */
export const MachineSchema = z.object({
  id: UrnSchema.optional(),
  name: z.string()
    .min(3, "Nombre debe tener al menos 3 caracteres")
    .max(100, "Nombre no puede exceder 100 caracteres"),
  serialNumber: z.string()
    .min(5, "Número de serie debe tener al menos 5 caracteres")
    .max(50, "Número de serie no puede exceder 50 caracteres"),
  operatingHours: z.number()
    .min(0, "Horas de operación no pueden ser negativas")
    .optional(),
  vibration: z.number()
    .min(0, "Vibración no puede ser negativa")
    .max(10, "Vibración máxima: 10g")
    .optional(),
  maintenanceStatus: z.enum(["operational", "check_required", "maintenance", "critical"]).default("operational"),
  temperature: z.number()
    .min(-20, "Temperatura mínima: -20°C")
    .max(150, "Temperatura máxima: 150°C")
    .optional()
});

export type MachineFormData = z.infer<typeof MachineSchema>;

/**
 * Schema para Data Assets (PROCUREDATA Business Model)
 */
export const DataAssetSchema = z.object({
  id: UrnSchema.optional(),
  name: z.string()
    .min(5, "Nombre debe tener al menos 5 caracteres")
    .max(200, "Nombre no puede exceder 200 caracteres"),
  description: z.string()
    .min(10, "Descripción debe tener al menos 10 caracteres")
    .max(1000, "Descripción no puede exceder 1000 caracteres"),
  dataType: z.enum(["iot", "esg", "financial", "array"]),
  provider: z.string()
    .min(2, "Proveedor debe tener al menos 2 caracteres")
    .max(100, "Proveedor no puede exceder 100 caracteres"),
  accessLevel: z.enum(["public", "restricted", "confidential"]).default("restricted")
});

export type DataAssetFormData = z.infer<typeof DataAssetSchema>;

/**
 * Schema para Políticas de Uso (IDS/ODRL)
 */
export const PolicySchema = z.object({
  id: UrnSchema.optional(),
  title: z.string()
    .min(5, "Título debe tener al menos 5 caracteres")
    .max(100, "Título no puede exceder 100 caracteres"),
  description: z.string()
    .min(10, "Descripción debe tener al menos 10 caracteres")
    .max(500, "Descripción no puede exceder 500 caracteres"),
  action: z.enum(["read", "write", "delete", "execute", "share"]),
  constraint: z.string()
    .max(200, "Restricción no puede exceder 200 caracteres")
    .optional(),
  duration: z.number()
    .min(1, "Duración mínima: 1 día")
    .max(365, "Duración máxima: 365 días")
    .optional()
});

export type PolicyFormData = z.infer<typeof PolicySchema>;

/**
 * Schema para publicación de recursos IDS
 */
export const IDSResourcePublishSchema = z.object({
  sourceEntityId: UrnSchema,
  title: z.string()
    .min(5, "Título debe tener al menos 5 caracteres")
    .max(100, "Título no puede exceder 100 caracteres"),
  description: z.string()
    .min(10, "Descripción debe tener al menos 10 caracteres")
    .max(500, "Descripción no puede exceder 500 caracteres"),
  policy: z.enum(["read-only", "time-restricted", "payment"]),
  keywords: z.array(z.string().min(2).max(30))
    .min(1, "Añade al menos una palabra clave")
    .max(10, "Máximo 10 palabras clave")
});

export type IDSResourcePublishData = z.infer<typeof IDSResourcePublishSchema>;

/**
 * Validación helper con mensajes de error amigables
 */
export const validateEntity = <T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } => {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(err => 
    `${err.path.join('.')}: ${err.message}`
  );
  
  return { success: false, errors };
};
