import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { fiwareApi } from '@/services/fiwareApi';
import { UserPlus, Loader2 } from 'lucide-react';

const CreateUserForm = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const createUserMutation = useMutation({
    mutationFn: (userData: typeof formData) => fiwareApi.createKeyrockUser(userData),
    onSuccess: (response) => {
      if (response.success) {
        toast({
          title: 'Usuario creado',
          description: `Usuario ${formData.username} creado exitosamente en Keyrock`
        });
        setFormData({ username: '', email: '', password: '' });
        queryClient.invalidateQueries({ queryKey: ['keyrock-users'] });
      } else {
        toast({
          title: 'Error',
          description: response.error || 'No se pudo crear el usuario',
          variant: 'destructive'
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al crear usuario',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.email || !formData.password) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa todos los campos',
        variant: 'destructive'
      });
      return;
    }

    createUserMutation.mutate(formData);
  };

  return (
    <Card className="border-border/40 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          Provisionar Nuevo Usuario
        </CardTitle>
        <CardDescription>
          Crear usuarios y asignar roles en Keyrock Identity Manager
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Nombre de Usuario</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="usuario_fiware"
              disabled={createUserMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="usuario@procuredata.com"
              disabled={createUserMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              disabled={createUserMutation.isPending}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createUserMutation.isPending}
          >
            {createUserMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Crear Usuario
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateUserForm;
