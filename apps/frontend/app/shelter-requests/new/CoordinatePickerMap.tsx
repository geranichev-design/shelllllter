'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';

export type CoordinatePoint = {
  latitude: number;
  longitude: number;
};

type CoordinatePickerMapProps = {
  point: CoordinatePoint;
  onChange: (point: CoordinatePoint) => void;
};

function ClickHandler({ onChange }: Pick<CoordinatePickerMapProps, 'onChange'>) {
  useMapEvents({
    click(event) {
      onChange({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return null;
}

function MapSync({ point }: { point: CoordinatePoint }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo([point.latitude, point.longitude], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 0.6,
    });
  }, [map, point.latitude, point.longitude]);

  return null;
}

export default function CoordinatePickerMap({ point, onChange }: CoordinatePickerMapProps) {
  return (
    <MapContainer
      center={[point.latitude, point.longitude]}
      zoom={15}
      scrollWheelZoom
      zoomControl
      attributionControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      <MapSync point={point} />
      <ClickHandler onChange={onChange} />
      <CircleMarker
        center={[point.latitude, point.longitude]}
        radius={9}
        pathOptions={{
          color: '#ffffff',
          weight: 3,
          fillColor: '#ff6b6b',
          fillOpacity: 0.95,
        }}
      />
      <CircleMarker
        center={[point.latitude, point.longitude]}
        radius={18}
        pathOptions={{
          color: 'rgba(255,107,107,0.35)',
          weight: 2,
          fillColor: 'rgba(255,107,107,0.18)',
          fillOpacity: 0.45,
        }}
      />
    </MapContainer>
  );
}
