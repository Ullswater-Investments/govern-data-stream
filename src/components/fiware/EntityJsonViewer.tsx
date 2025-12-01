import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCheck, Code2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { NgsiEntity } from '@/types/fiware';

interface EntityJsonViewerProps {
  entity: NgsiEntity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EntityJsonViewer = ({ entity, open, onOpenChange }: EntityJsonViewerProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const jsonString = JSON.stringify(entity, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast({
        title: 'Copiado',
        description: 'JSON-LD copiado al portapapeles'
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar al portapapeles',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="w-5 h-5" />
            JSON-LD Completo
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant="outline">{entity.type}</Badge>
            <span className="font-mono text-xs">{entity.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? (
                <>
                  <CheckCheck className="w-4 h-4" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar JSON
                </>
              )}
            </Button>
          </div>

          <div className="relative">
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto max-h-[50vh] text-xs border border-border/50">
              <code className="language-json">{jsonString}</code>
            </pre>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Contexto:</strong> {entity['@context'] ? 'Definido' : 'Por defecto'}
            </p>
            <p>
              <strong>Propiedades:</strong>{' '}
              {Object.keys(entity).filter(k => !['id', 'type', '@context'].includes(k)).length}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EntityJsonViewer;
