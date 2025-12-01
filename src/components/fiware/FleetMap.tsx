import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { DeviceEntity } from '@/types/fiware';
import { normalizeNgsiEntity } from '@/services/fiwareApi';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface FleetMapProps {
  devices: DeviceEntity[];
}

const MapController = ({ devices }: { devices: DeviceEntity[] }) => {
  const map = useMap();

  useEffect(() => {
    if (devices.length > 0) {
      const validDevices = devices.filter(d => {
        const normalized = normalizeNgsiEntity(d);
        return normalized.location?.coordinates;
      });

      if (validDevices.length > 0) {
        const bounds = validDevices.map(d => {
          const normalized = normalizeNgsiEntity(d);
          const coords = normalized.location.coordinates;
          // NGSI-LD usa [longitude, latitude], Leaflet usa [latitude, longitude]
          return [coords[1], coords[0]] as [number, number];
        });

        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [devices, map]);

  return null;
};

const FleetMap = ({ devices }: FleetMapProps) => {
  const [mapReady, setMapReady] = useState(false);

  const devicesWithLocation = devices.filter(device => {
    const normalized = normalizeNgsiEntity(device);
    return normalized.location?.coordinates;
  });

  if (devicesWithLocation.length === 0) {
    return (
      <Card className="border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Mapa de Flota IoT
          </CardTitle>
          <CardDescription>
            Visualización geoespacial de dispositivos con GeoProperty
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center bg-muted/30 rounded-lg text-muted-foreground">
            No hay dispositivos con coordenadas geográficas disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          Mapa de Flota IoT
        </CardTitle>
        <CardDescription>
          {devicesWithLocation.length} dispositivos geolocalizados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] rounded-lg overflow-hidden border border-border/50">
          <MapContainer
            center={[40.4168, -3.7038]}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
            whenReady={() => setMapReady(true)}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {mapReady && <MapController devices={devicesWithLocation} />}

            {devicesWithLocation.map((device) => {
              const normalized = normalizeNgsiEntity(device);
              const coords = normalized.location.coordinates;
              // Invertir coordenadas: NGSI-LD [long, lat] → Leaflet [lat, long]
              const position: [number, number] = [coords[1], coords[0]];

              return (
                <Marker key={device.id} position={position}>
                  <Popup>
                    <div className="space-y-2 min-w-[200px]">
                      <div>
                        <Badge variant="outline" className="mb-1">
                          {device.type}
                        </Badge>
                        <h3 className="font-semibold text-sm">
                          {normalized.name || device.id}
                        </h3>
                      </div>
                      
                      {normalized.description && (
                        <p className="text-xs text-muted-foreground">
                          {normalized.description}
                        </p>
                      )}

                      {normalized.status && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs">Estado:</span>
                          <Badge 
                            variant={normalized.status === 'ok' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {normalized.status}
                          </Badge>
                        </div>
                      )}

                      {normalized.batteryLevel !== undefined && (
                        <div className="text-xs">
                          Batería: <span className="font-medium">{normalized.batteryLevel}%</span>
                        </div>
                      )}

                      {normalized.rssi !== undefined && (
                        <div className="text-xs">
                          Señal: <span className="font-medium">{normalized.rssi} dBm</span>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground pt-1 border-t">
                        <code className="text-xs">{device.id}</code>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default FleetMap;
