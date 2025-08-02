import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { scaleLinear } from 'd3-scale';
import { interpolateReds } from 'd3-scale-chromatic';

// Component to handle map bounds updates
const MapBounds = ({ bounds }) => {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  
  return null;
};

const GeoHeatMap = ({ data, height = '500px' }) => {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapBounds, setMapBounds] = useState([]);
  const [stats, setStats] = useState({
    totalEmails: 0,
    uniqueCountries: 0,
    uniqueCities: 0,
    topDestination: ''
  });

  useEffect(() => {
    if (!data || data.length === 0) return;

    // Calculate statistics
    const totalEmails = data.reduce((sum, loc) => sum + loc.count, 0);
    const countries = new Set(data.map(loc => loc.country));
    const cities = new Set(data.map(loc => loc.city));
    const topDest = data.reduce((max, loc) => 
      loc.count > (max?.count || 0) ? loc : max, null);

    setStats({
      totalEmails,
      uniqueCountries: countries.size,
      uniqueCities: cities.size,
      topDestination: topDest ? `${topDest.city}, ${topDest.country}` : 'N/A'
    });

    // Calculate map bounds
    if (data.length > 0) {
      const bounds = data.map(loc => [loc.lat, loc.lng]);
      setMapBounds(bounds);
    }
  }, [data]);

  // Create color scale based on email count
  const maxCount = Math.max(...(data?.map(d => d.count) || [1]));
  const colorScale = scaleLinear()
    .domain([0, maxCount])
    .range([0, 1]);

  const getColor = (count) => {
    return interpolateReds(colorScale(count));
  };

  const getRadius = (count) => {
    const scale = scaleLinear()
      .domain([0, maxCount])
      .range([5, 30]);
    return scale(count);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Geographic Email Distribution</h3>
        <p className="text-sm text-gray-600">
          Real-time visualization of email destinations worldwide
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-600">
            {stats.totalEmails.toLocaleString()}
          </div>
          <div className="text-xs text-gray-600">Total Emails</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-600">
            {stats.uniqueCountries}
          </div>
          <div className="text-xs text-gray-600">Countries</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-purple-600">
            {stats.uniqueCities}
          </div>
          <div className="text-xs text-gray-600">Cities</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3">
          <div className="text-sm font-semibold text-amber-600 truncate">
            {stats.topDestination}
          </div>
          <div className="text-xs text-gray-600">Top Destination</div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height }}>
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          <MapBounds bounds={mapBounds} />
          
          {data && data.map((location, index) => (
            <CircleMarker
              key={index}
              center={[location.lat, location.lng]}
              radius={getRadius(location.count)}
              fillColor={getColor(location.count)}
              color="#1F2937"
              weight={1}
              opacity={0.8}
              fillOpacity={0.6}
              eventHandlers={{
                click: () => setSelectedLocation(location),
                mouseover: (e) => {
                  e.target.setStyle({
                    weight: 3,
                    fillOpacity: 0.9
                  });
                },
                mouseout: (e) => {
                  e.target.setStyle({
                    weight: 1,
                    fillOpacity: 0.6
                  });
                }
              }}
            >
              <Popup>
                <div className="p-2">
                  <div className="font-semibold text-gray-900">
                    {location.city}, {location.country}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    <div>Emails: {location.count.toLocaleString()}</div>
                    <div>Success Rate: {location.successRate || 100}%</div>
                    <div>Avg. Size: {location.avgSize || 'N/A'}</div>
                  </div>
                  {location.topRecipients && (
                    <div className="text-xs text-gray-500 mt-2">
                      <div className="font-semibold">Top Recipients:</div>
                      {location.topRecipients.slice(0, 3).map((r, i) => (
                        <div key={i}>{r}</div>
                      ))}
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Heat Scale Legend */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-10">
          <div className="text-xs font-semibold text-gray-700 mb-2">Email Volume</div>
          <div className="flex items-center space-x-2">
            <div className="flex">
              {[0, 0.25, 0.5, 0.75, 1].map((value, i) => (
                <div
                  key={i}
                  className="w-6 h-6"
                  style={{ backgroundColor: interpolateReds(value) }}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-600 w-full">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        </div>

        {/* Selected Location Details */}
        {selectedLocation && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs z-10">
            <button
              onClick={() => setSelectedLocation(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
            <div className="font-semibold text-gray-900">
              {selectedLocation.city}, {selectedLocation.country}
            </div>
            <div className="text-sm text-gray-600 mt-2 space-y-1">
              <div>📧 Total Emails: {selectedLocation.count.toLocaleString()}</div>
              <div>✅ Success Rate: {selectedLocation.successRate || 100}%</div>
              <div>📊 Avg. Size: {selectedLocation.avgSize || 'N/A'}</div>
              <div>⏱️ Avg. Delivery: {selectedLocation.avgDeliveryTime || 'N/A'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Top Destinations List */}
      <div className="mt-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Top 5 Destinations</h4>
        <div className="space-y-2">
          {data?.slice(0, 5).map((location, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getColor(location.count) }}
                />
                <span className="text-gray-700">
                  {location.city}, {location.country}
                </span>
              </div>
              <span className="font-semibold text-gray-900">
                {location.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GeoHeatMap;