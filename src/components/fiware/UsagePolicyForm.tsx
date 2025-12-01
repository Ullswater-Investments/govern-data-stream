import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Shield, Plus } from 'lucide-react';

const UsagePolicyForm = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    target: '',
    action: 'read',
    duration: '7',
    constraint: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generar estructura ODRL 2.0
    const policy = {
      '@context': 'http://www.w3.org/ns/odrl.jsonld',
      '@type': 'Set',
      'uid': `urn:ids:policy:${Date.now()}`,
      'profile': 'http://example.com/ids-profile',
      'permission': [{
        'target': formData.target,
        'action': formData.action,
        'constraint': [{
          'leftOperand': 'elapsedTime',
          'operator': 'lteq',
          'rightOperand': `P${formData.duration}D`
        }]
      }]
    };

    console.log('Generated ODRL Policy:', policy);
    
    toast({
      title: 'Política creada',
      description: `Política de uso generada: ${formData.duration} días de acceso ${formData.action}`,
    });

    // Reset form
    setFormData({
      title: '',
      target: '',
      action: 'read',
      duration: '7',
      constraint: ''
    });
  };

  return (
    <Card className="border-border/40 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Crear Política de Uso (ODRL)
        </CardTitle>
        <CardDescription>
          Define restricciones temporales y de acceso para recursos IDS
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título de la Política</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Acceso temporal a datos IoT"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target">Recurso Objetivo (URN)</Label>
            <Input
              id="target"
              value={formData.target}
              onChange={(e) => setFormData({ ...formData, target: e.target.value })}
              placeholder="urn:ngsi-ld:DataAsset:001"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="action">Acción Permitida</Label>
              <Select
                value={formData.action}
                onValueChange={(value) => setFormData({ ...formData, action: value })}
              >
                <SelectTrigger id="action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Lectura (Read)</SelectItem>
                  <SelectItem value="use">Uso (Use)</SelectItem>
                  <SelectItem value="modify">Modificar (Modify)</SelectItem>
                  <SelectItem value="distribute">Distribuir (Distribute)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duración (días)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="7"
                min="1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="constraint">Restricciones Adicionales (opcional)</Label>
            <Textarea
              id="constraint"
              value={formData.constraint}
              onChange={(e) => setFormData({ ...formData, constraint: e.target.value })}
              placeholder="Ejemplo: Uso solo para análisis interno"
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Generar Política ODRL
          </Button>
        </form>

        <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs space-y-1">
          <p className="font-medium text-foreground">Vista Previa ODRL:</p>
          <code className="text-muted-foreground">
            {formData.target ? (
              <>Permitir <strong>{formData.action}</strong> en {formData.target} por {formData.duration} días</>
            ) : (
              'Completa el formulario para ver la política'
            )}
          </code>
        </div>
      </CardContent>
    </Card>
  );
};

export default UsagePolicyForm;
