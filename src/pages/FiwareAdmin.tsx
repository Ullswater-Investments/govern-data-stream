import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { fiwareApi, normalizeNgsiEntity } from '@/services/fiwareApi';
import { 
  Database, 
  Users, 
  Shield, 
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Plus
} from 'lucide-react';
import type { NgsiEntity } from '@/types/fiware';

const FiwareAdmin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Health status query
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['fiware-health'],
    queryFn: () => fiwareApi.getHealthStatus(),
    refetchInterval: 30000 // Refresh every 30s
  });

  // Entities query
  const { data: entitiesResponse, isLoading: entitiesLoading } = useQuery({
    queryKey: ['fiware-entities'],
    queryFn: () => fiwareApi.getEntities()
  });

  // Keyrock users query
  const { data: usersResponse, isLoading: usersLoading } = useQuery({
    queryKey: ['keyrock-users'],
    queryFn: () => fiwareApi.getKeyrockUsers()
  });

  // Connector resources query
  const { data: resourcesResponse, isLoading: resourcesLoading } = useQuery({
    queryKey: ['connector-resources'],
    queryFn: () => fiwareApi.getConnectorResources()
  });

  const StatusBadge = ({ connected }: { connected: boolean }) => (
    <Badge variant={connected ? 'default' : 'destructive'}>
      {connected ? (
        <>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Conectado
        </>
      ) : (
        <>
          <XCircle className="w-3 h-3 mr-1" />
          Desconectado
        </>
      )}
    </Badge>
  );

  const entities = entitiesResponse?.success ? entitiesResponse.data : [];
  const users = usersResponse?.success ? usersResponse.data : [];
  const resources = resourcesResponse?.success ? resourcesResponse.data : [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Panel FIWARE</h1>
            <p className="text-muted-foreground mt-1">
              Administración del Nodo de Espacio de Datos
            </p>
          </div>
          <Button onClick={() => refetchHealth()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar Estado
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border/40 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Context Broker</CardTitle>
              <Database className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-foreground">Orion-LD</div>
                  {health?.orion.version && (
                    <p className="text-xs text-muted-foreground mt-1">
                      v{health.orion.version}
                    </p>
                  )}
                </div>
                {health && <StatusBadge connected={health.orion.connected} />}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Identity Management</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-foreground">Keyrock</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {users.length} usuarios
                  </p>
                </div>
                {health && <StatusBadge connected={health.keyrock.connected} />}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">IDS Connector</CardTitle>
              <Shield className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-foreground">TRUE Connector</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {resources.length} recursos
                  </p>
                </div>
                {health && <StatusBadge connected={health.trueConnector.connected} />}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Standby Warning */}
        {entitiesResponse?.status === 'standby' && (
          <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-5 h-5" />
                Modo Espera
              </CardTitle>
              <CardDescription className="text-amber-600 dark:text-amber-500">
                El backend FIWARE no está configurado. Configura las variables de entorno
                FIWARE_HOST, FIWARE_USER, FIWARE_PASS e IDM_HOST en los secretos de Supabase.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="entities" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="entities">
              <Database className="w-4 h-4 mr-2" />
              Entidades NGSI-LD
            </TabsTrigger>
            <TabsTrigger value="keyrock">
              <Users className="w-4 h-4 mr-2" />
              Keyrock
            </TabsTrigger>
            <TabsTrigger value="ids">
              <Shield className="w-4 h-4 mr-2" />
              IDS Connector
            </TabsTrigger>
          </TabsList>

          {/* Entities Tab */}
          <TabsContent value="entities" className="space-y-4">
            <Card className="border-border/40 shadow-lg">
              <CardHeader>
                <CardTitle>Entidades del Context Broker</CardTitle>
                <CardDescription>
                  Gestión de entidades NGSI-LD en tiempo real
                </CardDescription>
              </CardHeader>
              <CardContent>
                {entitiesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Cargando...</div>
                ) : entities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay entidades disponibles. Crea tu primera entidad IoT o DataAsset.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {entities.map((entity: NgsiEntity) => {
                      const normalized = normalizeNgsiEntity(entity);
                      return (
                        <div
                          key={entity.id}
                          className="p-4 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{entity.type}</Badge>
                                <span className="font-mono text-sm text-muted-foreground">
                                  {entity.id}
                                </span>
                              </div>
                              {normalized.name && (
                                <p className="font-medium text-foreground">{normalized.name}</p>
                              )}
                              {normalized.description && (
                                <p className="text-sm text-muted-foreground">{normalized.description}</p>
                              )}
                            </div>
                            <Button variant="ghost" size="sm">
                              Ver JSON
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Keyrock Tab */}
          <TabsContent value="keyrock" className="space-y-4">
            <Card className="border-border/40 shadow-lg">
              <CardHeader>
                <CardTitle>Gestión de Usuarios y Roles</CardTitle>
                <CardDescription>
                  Administra usuarios, organizaciones y permisos en Keyrock
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Cargando...</div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Funcionalidad de gestión de usuarios disponible cuando Keyrock esté conectado.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* IDS Connector Tab */}
          <TabsContent value="ids" className="space-y-4">
            <Card className="border-border/40 shadow-lg">
              <CardHeader>
                <CardTitle>Recursos y Contratos IDS</CardTitle>
                <CardDescription>
                  Gestión de políticas de uso y contratos de intercambio de datos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resourcesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Cargando...</div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Recursos y contratos disponibles cuando TRUE Connector esté conectado.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default FiwareAdmin;
