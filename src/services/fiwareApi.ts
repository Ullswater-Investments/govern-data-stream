import { supabase } from '@/integrations/supabase/client';
import type { 
  NgsiEntity, 
  DeviceEntity, 
  DataAssetEntity,
  PolicyEntity,
  FiwareHealthStatus,
  FiwareApiResponse,
  NormalizedEntity
} from '@/types/fiware';

/**
 * FIWARE API Service
 * Handles all communication with FIWARE Context Broker (Orion-LD),
 * Keyrock (Identity Management), and TRUE Connector (IDS)
 * via the Supabase Edge Function proxy
 */

class FiwareApiService {
  private baseUrl = '/ngsi-ld/v1/entities';

  /**
   * Generic proxy request handler
   */
  private async proxyRequest<T = any>(
    path: string,
    method: string = 'GET',
    body?: any,
    skipAuth: boolean = false
  ): Promise<FiwareApiResponse<T>> {
    try {
      console.log(`[FIWARE API] ${method} ${path}`);

      const { data, error } = await supabase.functions.invoke('fiware-proxy', {
        body: { path, method, body, skipAuth }
      });

      if (error) {
        console.error('[FIWARE API] Proxy error:', error);
        return {
          success: false,
          error: error.message,
          status: 'error'
        };
      }

      // Handle standby mode (FIWARE not configured)
      if (data?.status === 'standby') {
        console.warn('[FIWARE API] Backend in standby mode');
        return {
          success: false,
          error: data.message,
          status: 'standby'
        };
      }

      return {
        success: true,
        data: data,
        status: 'connected'
      };

    } catch (error) {
      console.error('[FIWARE API] Request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      };
    }
  }

  /**
   * Get all entities of a specific type
   */
  async getEntities(type?: string, limit: number = 100): Promise<FiwareApiResponse<NgsiEntity[]>> {
    const query = type ? `?type=${type}&limit=${limit}` : `?limit=${limit}`;
    return this.proxyRequest<NgsiEntity[]>(`${this.baseUrl}${query}`, 'GET');
  }

  /**
   * Get a single entity by ID
   */
  async getEntity(entityId: string): Promise<FiwareApiResponse<NgsiEntity>> {
    return this.proxyRequest<NgsiEntity>(`${this.baseUrl}/${entityId}`, 'GET');
  }

  /**
   * Create a new NGSI-LD entity
   */
  async createEntity(entity: Partial<NgsiEntity>): Promise<FiwareApiResponse<void>> {
    const entityWithContext = {
      ...entity,
      '@context': entity['@context'] || [
        'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld',
        'https://smartdatamodels.org/context.jsonld'
      ]
    };

    return this.proxyRequest<void>(this.baseUrl, 'POST', entityWithContext);
  }

  /**
   * Update an existing entity (partial update)
   */
  async updateEntity(entityId: string, updates: Partial<NgsiEntity>): Promise<FiwareApiResponse<void>> {
    return this.proxyRequest<void>(
      `${this.baseUrl}/${entityId}/attrs`,
      'PATCH',
      updates
    );
  }

  /**
   * Delete an entity
   */
  async deleteEntity(entityId: string): Promise<FiwareApiResponse<void>> {
    return this.proxyRequest<void>(`${this.baseUrl}/${entityId}`, 'DELETE');
  }

  /**
   * Get IoT devices (Smart Data Models)
   */
  async getDevices(): Promise<FiwareApiResponse<DeviceEntity[]>> {
    return this.proxyRequest<DeviceEntity[]>(`${this.baseUrl}?type=Device`, 'GET');
  }

  /**
   * Get Data Assets (for catalog integration)
   */
  async getDataAssets(): Promise<FiwareApiResponse<DataAssetEntity[]>> {
    return this.proxyRequest<DataAssetEntity[]>(`${this.baseUrl}?type=DataAsset`, 'GET');
  }

  /**
   * Keyrock: Get users list
   */
  async getKeyrockUsers(): Promise<FiwareApiResponse<any[]>> {
    return this.proxyRequest<any[]>('/v1/users', 'GET');
  }

  /**
   * Keyrock: Create new user
   */
  async createKeyrockUser(userData: {
    username: string;
    email: string;
    password: string;
  }): Promise<FiwareApiResponse<any>> {
    return this.proxyRequest<any>('/v1/users', 'POST', { user: userData });
  }

  /**
   * TRUE Connector: Get published resources
   */
  async getConnectorResources(): Promise<FiwareApiResponse<any[]>> {
    return this.proxyRequest<any[]>('/api/resources', 'GET', undefined, true);
  }

  /**
   * TRUE Connector: Get IDS policies/contracts
   */
  async getConnectorPolicies(): Promise<FiwareApiResponse<PolicyEntity[]>> {
    return this.proxyRequest<PolicyEntity[]>('/api/offers', 'GET', undefined, true);
  }

  /**
   * Health check for all FIWARE components
   */
  async getHealthStatus(): Promise<FiwareHealthStatus> {
    const [orionCheck, keyrockCheck, connectorCheck] = await Promise.allSettled([
      this.proxyRequest('/version', 'GET', undefined, true),
      this.proxyRequest('/v1/applications', 'GET'),
      this.proxyRequest('/api/resources', 'GET', undefined, true)
    ]);

    return {
      orion: {
        connected: orionCheck.status === 'fulfilled' && orionCheck.value.success,
        version: orionCheck.status === 'fulfilled' ? orionCheck.value.data?.version : undefined
      },
      keyrock: {
        connected: keyrockCheck.status === 'fulfilled' && keyrockCheck.value.success
      },
      trueConnector: {
        connected: connectorCheck.status === 'fulfilled' && connectorCheck.value.success
      }
    };
  }
}

/**
 * Adapter: Convert NGSI-LD nested structure to flat JSON
 * Example: { temperature: { type: 'Property', value: 23.5 } } → { temperature: 23.5 }
 */
export const normalizeNgsiEntity = (entity: NgsiEntity): NormalizedEntity => {
  const normalized: NormalizedEntity = {
    id: entity.id,
    type: entity.type
  };

  Object.keys(entity).forEach(key => {
    if (['id', 'type', '@context'].includes(key)) return;

    const value = entity[key];
    if (value && typeof value === 'object' && 'value' in value) {
      normalized[key] = value.value;
    } else if (value && typeof value === 'object' && 'object' in value) {
      // Relationship
      normalized[key] = value.object;
    } else {
      normalized[key] = value;
    }
  });

  return normalized;
};

/**
 * Adapter: Convert flat JSON to NGSI-LD structure
 */
export const toNgsiEntity = (data: Record<string, any>, type: string): Partial<NgsiEntity> => {
  const entity: any = {
    id: data.id || `urn:ngsi-ld:${type}:${Date.now()}`,
    type
  };

  Object.keys(data).forEach(key => {
    if (['id', 'type'].includes(key)) return;

    entity[key] = {
      type: 'Property',
      value: data[key]
    };
  });

  return entity;
};

export const fiwareApi = new FiwareApiService();
