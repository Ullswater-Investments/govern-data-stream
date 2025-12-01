// NGSI-LD Entity Types (Based on Smart Data Models)
export type EntityType = 
  | 'Device' 
  | 'Sensor' 
  | 'DataAsset'
  | 'Organization'
  | 'Policy'
  | 'Contract';

// NGSI-LD Property structure
export interface NgsiProperty<T = any> {
  type: 'Property';
  value: T;
  observedAt?: string;
  unitCode?: string;
}

// NGSI-LD Relationship structure
export interface NgsiRelationship {
  type: 'Relationship';
  object: string; // Entity ID reference
}

// Base NGSI-LD Entity
export interface NgsiEntity {
  id: string;
  type: EntityType;
  '@context'?: string | string[];
  [key: string]: NgsiProperty | NgsiRelationship | string | string[] | undefined;
}

// IoT Device Entity (Smart Data Models compliant)
export interface DeviceEntity extends NgsiEntity {
  type: 'Device';
  name: NgsiProperty<string>;
  description?: NgsiProperty<string>;
  deviceCategory?: NgsiProperty<string[]>;
  controlledProperty?: NgsiProperty<string[]>;
  supportedProtocol?: NgsiProperty<string[]>;
  location?: NgsiProperty<{
    type: 'Point';
    coordinates: [number, number];
  }>;
  status?: NgsiProperty<'ok' | 'error' | 'maintenance'>;
  batteryLevel?: NgsiProperty<number>;
  rssi?: NgsiProperty<number>;
  owner?: NgsiRelationship;
}

// Data Asset Entity (for catalog integration)
export interface DataAssetEntity extends NgsiEntity {
  type: 'DataAsset';
  name: NgsiProperty<string>;
  description: NgsiProperty<string>;
  dataType: NgsiProperty<'iot' | 'esg' | 'financial' | 'array'>;
  provider: NgsiRelationship;
  holder: NgsiRelationship;
  metadata?: NgsiProperty<Record<string, any>>;
  accessPolicy?: NgsiRelationship;
}

// IDS Policy Entity (TRUE Connector integration)
export interface PolicyEntity extends NgsiEntity {
  type: 'Policy';
  title: NgsiProperty<string>;
  permission: NgsiProperty<{
    target: string;
    action: string[];
    constraint?: Array<{
      leftOperand: string;
      operator: string;
      rightOperand: string;
    }>;
  }>;
  prohibition?: NgsiProperty<any[]>;
  obligation?: NgsiProperty<any[]>;
}

// Keyrock User/Organization (Identity Management)
export interface OrganizationEntity extends NgsiEntity {
  type: 'Organization';
  name: NgsiProperty<string>;
  description?: NgsiProperty<string>;
  address?: NgsiProperty<Record<string, any>>;
  contactPoint?: NgsiProperty<{
    email: string;
    telephone?: string;
  }>;
  roles?: NgsiProperty<string[]>;
}

// FIWARE Context Broker Health Status
export interface FiwareHealthStatus {
  orion: {
    connected: boolean;
    version?: string;
    entities?: number;
  };
  keyrock: {
    connected: boolean;
    users?: number;
    applications?: number;
  };
  trueConnector: {
    connected: boolean;
    resources?: number;
    contracts?: number;
    dapsStatus?: 'valid' | 'expired' | 'unknown';
  };
}

// Adapter function types
export type NormalizedEntity = {
  id: string;
  type: string;
  [key: string]: any;
};

// API Response types
export interface FiwareApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: 'connected' | 'standby' | 'error';
}
