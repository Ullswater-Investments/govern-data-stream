import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { fiwareApi, normalizeNgsiEntity } from '@/services/fiwareApi';
import FleetMap from '@/components/fiware/FleetMap';
import EntityJsonViewer from '@/components/fiware/EntityJsonViewer';
import CreateUserForm from '@/components/fiware/CreateUserForm';
import UsagePolicyForm from '@/components/fiware/UsagePolicyForm';
import { 
  Database, 
  Users, 
  Shield, 
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Server
} from 'lucide-react';
import type { NgsiEntity, DeviceEntity } from '@/types/fiware';

const FiwareAdminImproved = () => {
  const { toast } = useToast();
  const [selectedEntity, setSelectedEntity] = useState<NgsiEntity | null>(null);
  const [jsonViewerOpen, setJsonViewerOpen] = useState(false);

  // Health status query
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['fiware-health'],
    queryFn: () => fiwareApi.getHealthStatus(),
    refetchInterval: 30000
  });

  // Entities query
  const { data: entitiesResponse, isLoading: entitiesLoading } = useQuery({
    queryKey: ['fiware-entities'],
    queryFn: () => fiwareApi.getEntities()
  });

  // Devices query (for map)
  const { data: devicesResponse } = useQuery({
    queryKey: ['fiware-devices'],
    queryFn: () => fiwareApi.getDevices()
  });

  // Keyrock users query
  const { data: usersResponse } = useQuery({
    queryKey: ['keyrock-users'],
    queryFn: () => fiwareApi.getKeyrockUsers()
  });

  // Connector resources query
  const { data: resourcesResponse } = useQuery({
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

  const handleViewJson = (entity: NgsiEntity) => {
    setSelectedEntity(entity);
    setJsonViewerOpen(true);
  };

  const entities = entitiesResponse?.success ? entitiesResponse.data : [];
  const devices = devicesResponse?.success ? (devicesResponse.data as DeviceEntity[]) : [];
  const users = usersResponse?.success ? usersResponse.data : [];
  const resources = resourcesResponse?.success ? resourcesResponse.data : [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Panel FIWARE v2</h1>
            <p className="text-muted-foreground mt-1">
              Administración Avanzada del Espacio de Datos Industrial
            </p>
          </div>
          <Button onClick={() => refetchHealth()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar Estado
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border/40 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Context Broker</CardTitle>
              <Database className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-foreground">Orion-LD</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {entities.length} entidades
                  </p>
                </div>
                {health && <StatusBadge connected={health.orion.connected} />}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-lg hover:shadow-xl transition-shadow">
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

          <Card className="border-border/40 shadow-lg hover:shadow-xl transition-shadow">
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
                Modo Espera - Backend FIWARE no configurado
              </CardTitle>
              <CardDescription className="text-amber-600 dark:text-amber-500">
                Para activar el nodo, configura las variables de entorno en Supabase:
                FIWARE_HOST (http://tu-servidor:1027), IDM_HOST, FIWARE_USER y FIWARE_PASS.
                Consulta FIWARE_DEPLOYMENT.md para más detalles.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Fleet Map (visible solo si hay dispositivos con ubicación) */}
        {devices.length > 0 && <FleetMap devices={devices} />}

        {/* Main Tabs */}
        <Tabs defaultValue="entities" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="entities">
              <Server className="w-4 h-4 mr-2" />
              Context Broker
            </TabsTrigger>
            <TabsTrigger value="keyrock">
              <Users className="w-4 h-4 mr-2" />
              Identity Management
            </TabsTrigger>
            <TabsTrigger value="ids">
              <Shield className="w-4 h-4 mr-2" />
              IDS Connector
            </TabsTrigger>
          </TabsList>

          {/* Context Broker Tab */}
          <TabsContent value="entities" className="space-y-4">
            <Card className="border-border/40 shadow-lg">
              <CardHeader>
                <CardTitle>Entidades NGSI-LD en Tiempo Real</CardTitle>
                <CardDescription>
                  Gemelos digitales gestionados por Orion-LD Context Broker
                </CardDescription>
              </CardHeader>
              <CardContent>
                {entitiesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Cargando...</div>
                ) : entities.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Database className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="font-medium">No hay entidades disponibles</p>
                    <p className="text-sm mt-2">
                      Crea tu primera entidad IoT o DataAsset usando la API NGSI-LD
                    </p>
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
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="font-mono">
                                  {entity.type}
                                </Badge>
                                {normalized.status && (
                                  <Badge 
                                    variant={normalized.status === 'ok' ? 'default' : 'destructive'}
                                  >
                                    {normalized.status}
                                  </Badge>
                                )}
                              </div>
                              {normalized.name && (
                                <p className="font-medium text-foreground">{normalized.name}</p>
                              )}
                              {normalized.description && (
                                <p className="text-sm text-muted-foreground">{normalized.description}</p>
                              )}
                              <p className="text-xs font-mono text-muted-foreground">
                                {entity.id}
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewJson(entity)}
                            >
                              Ver JSON-LD
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CreateUserForm />
              
              <Card className="border-border/40 shadow-lg">
                <CardHeader>
                  <CardTitle>Usuarios Registrados</CardTitle>
                  <CardDescription>
                    Gestión de identidades en Keyrock
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {users.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No hay usuarios disponibles</p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Funcionalidad de listado disponible cuando Keyrock esté conectado
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* IDS Connector Tab */}
          <TabsContent value="ids" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UsagePolicyForm />

              <Card className="border-border/40 shadow-lg">
                <CardHeader>
                  <CardTitle>Recursos Publicados</CardTitle>
                  <CardDescription>
                    Activos compartibles en el espacio de datos IDS
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {resources.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No hay recursos publicados</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {resources.map((resource: any, idx: number) => (
                        <div 
                          key={idx}
                          className="p-3 border border-border/50 rounded-lg"
                        >
                          <p className="font-medium text-sm">{resource.title || 'Recurso sin título'}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {resource.id || `resource-${idx}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* JSON Viewer Dialog */}
      {selectedEntity && (
        <EntityJsonViewer
          entity={selectedEntity}
          open={jsonViewerOpen}
          onOpenChange={setJsonViewerOpen}
        />
      )}
    </Layout>
  );
};

export default FiwareAdminImproved;
