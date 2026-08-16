'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface VehicleBeacon {
  vehicleId: number;
  lat: number;
  lon: number;
  speedKmh: number;
  headingDeg: number;
  drivingScore: number;
  cabinStatus: string;
  hazard?: { level: string; };
}

interface Props {
  vehicles: VehicleBeacon[];
}

const VEHICLE_COLORS: Record<number, string> = {
  1: '#00d4ff',
  2: '#ff8800',
};

function createVehicleIcon(vehicleId: number, heading: number, hazardLevel: string) {
  const color = hazardLevel === 'high' ? '#ff3344' :
                hazardLevel === 'medium' ? '#ff8800' :
                VEHICLE_COLORS[vehicleId] || '#00d4ff';

  const svg = `
    <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${heading}, 18, 18)">
        <circle cx="18" cy="18" r="14" fill="${color}22" stroke="${color}" stroke-width="2"/>
        <polygon points="18,6 24,24 18,20 12,24" fill="${color}" opacity="0.9"/>
      </g>
      <text x="18" y="32" text-anchor="middle" fill="white" font-size="8" font-weight="bold"
            font-family="monospace">V${vehicleId}</text>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function VehicleMap({ vehicles }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [28.6139, 77.2090],  // Delhi default
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;

    vehicles.forEach(v => {
      if (!v.lat || !v.lon) return;
      const pos: L.LatLngExpression = [v.lat, v.lon];
      const icon = createVehicleIcon(v.vehicleId, v.headingDeg, v.hazard?.level || 'low');

      const existing = markersRef.current.get(v.vehicleId);
      if (existing) {
        existing.setLatLng(pos);
        existing.setIcon(icon);
      } else {
        const marker = L.marker(pos, { icon }).addTo(mapRef.current!);
        marker.bindPopup(`
          <div style="font-family:monospace;font-size:12px;">
            <strong>Vehicle ${v.vehicleId}</strong><br/>
            Speed: ${v.speedKmh} km/h<br/>
            Score: ${v.drivingScore}/100<br/>
            Cabin: ${v.cabinStatus}<br/>
            Pos: ${v.lat.toFixed(4)}, ${v.lon.toFixed(4)}
          </div>
        `);
        markersRef.current.set(v.vehicleId, marker);
      }
    });

    // Auto-fit bounds if we have vehicles
    if (vehicles.length > 0 && vehicles[0].lat) {
      const bounds = L.latLngBounds(
        vehicles.filter(v => v.lat && v.lon).map(v => [v.lat, v.lon] as L.LatLngExpression)
      );
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds.pad(0.3));
      }
    }
  }, [vehicles]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
