'use client';

import { useMemo, useState } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/maplibre';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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

// We use CARTO Dark Matter for a Palantir-like dark mode without API keys
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export default function VehicleMap({ vehicles }: Props) {
  const [popupInfo, setPopupInfo] = useState<VehicleBeacon | null>(null);

  // Compute view state based on vehicles
  const initialViewState = useMemo(() => {
    if (vehicles.length > 0 && vehicles[0].lat && vehicles[0].lon) {
      return {
        longitude: vehicles[0].lon,
        latitude: vehicles[0].lat,
        zoom: 14,
        pitch: 45, // Add some pitch for a 3D effect
      };
    }
    return {
      longitude: 77.2090, // Delhi default
      latitude: 28.6139,
      zoom: 14,
      pitch: 45,
    };
  }, [vehicles.length === 0]); // only recalculate if vehicles array goes from empty to populated

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Map
        initialViewState={initialViewState}
        mapStyle={MAP_STYLE}
        mapLib={maplibregl}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {vehicles.map(v => {
          if (!v.lat || !v.lon) return null;
          
          const hazardLevel = v.hazard?.level || 'low';
          const color = hazardLevel === 'high' ? '#ff3344' :
                        hazardLevel === 'medium' ? '#ff8800' :
                        VEHICLE_COLORS[v.vehicleId] || '#00d4ff';

          return (
            <Marker 
              key={`marker-${v.vehicleId}`}
              longitude={v.lon} 
              latitude={v.lat} 
              anchor="center"
              onClick={(e: any) => {

                e.originalEvent.stopPropagation();
                setPopupInfo(v);
              }}
            >
              <div style={{
                transform: `rotate(${v.headingDeg}deg)`,
                width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                filter: `drop-shadow(0 0 8px ${color}88)`
              }}>
                <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="18" cy="18" r="14" fill={`${color}22`} stroke={color} strokeWidth="2"/>
                  <polygon points="18,6 24,24 18,20 12,24" fill={color} opacity={0.9}/>
                </svg>
              </div>
              <div style={{
                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                color: 'white', fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace',
                marginTop: '2px', textShadow: '0 0 4px #000'
              }}>
                V{v.vehicleId}
              </div>
            </Marker>
          );
        })}

        {popupInfo && (
          <Popup
            longitude={popupInfo.lon}
            latitude={popupInfo.lat}
            anchor="bottom"
            onClose={() => setPopupInfo(null)}
            closeButton={false}
            className="custom-popup"
            style={{ fontFamily: 'monospace', fontSize: '12px', background: 'transparent' }}
          >
            <div style={{
              background: 'rgba(12, 13, 20, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '12px',
              borderRadius: '8px',
              color: '#e8eaf0',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
              <strong style={{ color: VEHICLE_COLORS[popupInfo.vehicleId] || '#00d4ff', fontSize: '14px' }}>
                Vehicle {popupInfo.vehicleId}
              </strong><br/>
              <div style={{ marginTop: '8px' }}>Speed: {popupInfo.speedKmh} km/h</div>
              <div>Score: {popupInfo.drivingScore}/100</div>
              <div>Cabin: {popupInfo.cabinStatus}</div>
              <div style={{ fontSize: '10px', color: '#7a8098', marginTop: '4px' }}>
                {popupInfo.lat.toFixed(4)}, {popupInfo.lon.toFixed(4)}
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
