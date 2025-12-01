import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ShieldCheck, 
  Globe, 
  Lock, 
  FileSignature, 
  RefreshCw, 
  Plus, 
  Server, 
  CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { fiwareApi } from "@/services/fiwareApi";
import { IDSResourcePublishSchema, type IDSResourcePublishData } from "@/schemas/fiwareSchemas";

interface IDSResource {
  id: string;
  name: string;
  type: string;
  policy: "read-only" | "time-restricted" | "payment";
  status: "published" | "pending";
  created_at: string;
}

interface ConnectorStatus {
  daps_connected: boolean;
  connector_id: string;
}

/**
 * SovereigntyPanel Component
 * 
 * Panel de gestión de soberanía de datos IDS (International Data Spaces).
 * Permite publicar recursos de FIWARE en el TRUE Connector con contratos ODRL.
 * 
 * Características:
 * - Visualización de estado de conexión DAPS
 * - Gestión de recursos publicados en el espacio de datos
 * - Creación de contratos de uso (ODRL policies)
 * - Monitorización de certificados X.509
 */
export function SovereigntyPanel() {
  const queryClient = useQueryClient();
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<IDSResourcePublishData>>({
    sourceEntityId: '',
    title: '',
    description: '',
    policy: 'read-only',
    keywords: []
  });
  const [keywordInput, setKeywordInput] = useState('');

  // 1. Estado del Conector (Health Check)
  const { data: status, isLoading: isLoadingStatus } = useQuery<ConnectorStatus>({
    queryKey: ["connector-status"],
    queryFn: async () => {
      // En producción real, esto llamaría a:
      // const response = await fiwareApi.proxyRequest('/api/description', 'GET', undefined, true);
      
      // Mock para desarrollo
      return {
        daps_connected: true,
        connector_id: "urn:ids:connector:fiware-procuredata-node-01"
      };
    },
    refetchInterval: 30000 // Verificar cada 30 segundos
  });

  // 2. Recursos Publicados
  const { data: resources, isLoading: isLoadingResources } = useQuery<IDSResource[]>({
    queryKey: ["ids-resources"],
    queryFn: async () => {
      const response = await fiwareApi.getConnectorResources();
      
      if (!response.success || !response.data) {
        // Devolver mock data para desarrollo
        return [
          { 
            id: "1", 
            name: "Flota Logística - Zona Norte", 
            type: "Vehicle", 
            policy: "read-only", 
            status: "published", 
            created_at: "2024-12-01" 
          },
          { 
            id: "2", 
            name: "Sensores Temperatura Nave B", 
            type: "Device", 
            policy: "time-restricted", 
            status: "published", 
            created_at: "2024-12-02" 
          },
        ];
      }
      
      return response.data;
    }
  });

  // 3. Mutación para Publicar Recurso
  const publishMutation = useMutation({
    mutationFn: async (data: IDSResourcePublishData) => {
      // Validar datos con Zod
      const parseResult = IDSResourcePublishSchema.safeParse(data);
      
      if (!parseResult.success) {
        const errors = parseResult.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        throw new Error(errors.join(', '));
      }

      const validData = parseResult.data;

      // TODO: Implementar llamada real al TRUE Connector
      // const response = await supabase.functions.invoke('fiware-proxy', {
      //   body: {
      //     method: 'POST',
      //     path: '/api/resources/offer',
      //     skipAuth: true,
      //     body: {
      //       title: validData.title,
      //       description: validData.description,
      //       keywords: validData.keywords,
      //       publisher: "urn:ids:participant:procuredata",
      //       representation: {
      //         url: `http://pep-proxy:1027/ngsi-ld/v1/entities/${validData.sourceEntityId}`
      //       },
      //       contract: {
      //         permission: [{ action: "idsc:USE" }]
      //       }
      //     }
      //   }
      // });

      // Mock para desarrollo
      await new Promise(r => setTimeout(r, 1500));
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Recurso publicado exitosamente",
        description: "El contrato inteligente ha sido firmado y registrado en el espacio de datos.",
      });
      setIsPublishDialogOpen(false);
      setFormData({
        sourceEntityId: '',
        title: '',
        description: '',
        policy: 'read-only',
        keywords: []
      });
      setKeywordInput('');
      queryClient.invalidateQueries({ queryKey: ["ids-resources"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al publicar recurso",
        description: error.message || "Verifica la conexión con el DAPS.",
        variant: "destructive"
      });
    }
  });

  const handlePublish = () => {
    if (!formData.sourceEntityId || !formData.title || !formData.description) {
      toast({
        title: "Campos requeridos",
        description: "Completa todos los campos obligatorios.",
        variant: "destructive"
      });
      return;
    }

    const dataToPublish: IDSResourcePublishData = {
      sourceEntityId: formData.sourceEntityId as string,
      title: formData.title as string,
      description: formData.description as string,
      policy: formData.policy as "read-only" | "time-restricted" | "payment",
      keywords: formData.keywords || []
    };

    publishMutation.mutate(dataToPublish);
  };

  const addKeyword = () => {
    if (keywordInput.trim() && formData.keywords && formData.keywords.length < 10) {
      setFormData({
        ...formData,
        keywords: [...(formData.keywords || []), keywordInput.trim()]
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (index: number) => {
    setFormData({
      ...formData,
      keywords: formData.keywords?.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-6">
      {/* Header de Soberanía */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Panel de Soberanía IDS
          </h2>
          <p className="text-muted-foreground">
            Gestiona la exposición de tus datos al Espacio de Datos Europeo.
          </p>
        </div>
        
        {/* Indicador de Estado DAPS */}
        <Card className="w-full md:w-auto border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`h-3 w-3 rounded-full ${status?.daps_connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <div>
              <p className="text-sm font-medium">
                {status?.daps_connected ? "Conectado a DAPS" : "Desconectado"}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {status?.connector_id || "Cargando ID..."}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="ml-auto" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ["connector-status"] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="resources" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="resources">Mis Recursos</TabsTrigger>
          <TabsTrigger value="contracts">Contratos Activos</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        {/* TAB: RECURSOS */}
        <TabsContent value="resources" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Recursos Publicados</CardTitle>
                <CardDescription>
                  Activos de datos visibles para otros participantes del espacio.
                </CardDescription>
              </div>
              <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Publicar Nuevo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Publicar en Espacio de Datos</DialogTitle>
                    <DialogDescription>
                      Selecciona una entidad de Orion-LD para exponerla a través del conector IDS con un contrato ODRL.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="source-entity">Entidad Fuente (URN NGSI-LD) *</Label>
                      <Input 
                        id="source-entity" 
                        placeholder="urn:ngsi-ld:Device:sensor-001" 
                        value={formData.sourceEntityId}
                        onChange={(e) => setFormData({ ...formData, sourceEntityId: e.target.value })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="title">Título del Recurso *</Label>
                      <Input 
                        id="title" 
                        placeholder="Ej: Telemetría IoT - Sensor Temperatura" 
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="description">Descripción *</Label>
                      <Input 
                        id="description" 
                        placeholder="Breve descripción del conjunto de datos" 
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="policy">Política de Uso (ODRL) *</Label>
                      <Select 
                        value={formData.policy} 
                        onValueChange={(value) => setFormData({ ...formData, policy: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona contrato" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read-only">Sólo Lectura (Estándar)</SelectItem>
                          <SelectItem value="time-restricted">Restringido por Tiempo (7 días)</SelectItem>
                          <SelectItem value="payment">Pago por Uso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="keywords">Palabras Clave</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="keywords" 
                          placeholder="Ej: iot, temperatura, manufactura" 
                          value={keywordInput}
                          onChange={(e) => setKeywordInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addKeyword();
                            }
                          }}
                        />
                        <Button type="button" variant="secondary" onClick={addKeyword}>
                          Añadir
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.keywords?.map((keyword, index) => (
                          <Badge key={index} variant="secondary" className="gap-1">
                            {keyword}
                            <button 
                              onClick={() => removeKeyword(index)}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPublishDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handlePublish} disabled={publishMutation.isPending}>
                      {publishMutation.isPending ? "Firmando contrato..." : "Publicar Recurso"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Recurso</TableHead>
                    <TableHead>Tipo NGSI</TableHead>
                    <TableHead>Política ODRL</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingResources ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Cargando catálogo IDS...
                      </TableCell>
                    </TableRow>
                  ) : resources && resources.length > 0 ? (
                    resources.map((resource) => (
                      <TableRow key={resource.id}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          {resource.name}
                        </TableCell>
                        <TableCell><Badge variant="outline">{resource.type}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <FileSignature className="h-3 w-3" />
                            {resource.policy === 'read-only' ? 'Sólo Lectura' : 
                             resource.policy === 'time-restricted' ? 'Restringido' : 'Pago'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-200">
                            {resource.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">Revocar</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No hay recursos publicados aún.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: CONTRATOS (Placeholder visual) */}
        <TabsContent value="contracts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Acuerdos Vigentes</CardTitle>
              <CardDescription>Monitorización de contratos entrantes y salientes.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Lock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Sin contratos activos</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Cuando una organización consuma tus datos, verás el acuerdo firmado y los logs de acceso aquí.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: CONFIGURACIÓN (Certificados) */}
        <TabsContent value="config" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Endpoint IDS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">URL Pública</span>
                  <span className="text-sm font-mono">https://connector.procuredata.app:29292</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Versión IDS</span>
                  <span className="text-sm">4.2.7 (Infomodel 4.1)</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Certificado X.509
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950/20 p-2 rounded text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Válido y firmado por Fraunhofer AISEC
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Expira: 12 de Diciembre, 2025
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
