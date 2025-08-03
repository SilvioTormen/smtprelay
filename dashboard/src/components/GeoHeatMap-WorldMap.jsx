import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  AlertTitle,
  useTheme,
  Stack,
  Avatar,
  Tooltip
} from '@mui/material';
import {
  Public,
  Business,
  TableChart,
  Map as MapIcon,
  Router,
  Hub,
  TrendingUp,
  LocationOn,
  Speed,
  Email
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map animations and updates
const MapUpdater = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

const GeoHeatMap = ({ data, height = 500 }) => {
  const theme = useTheme();
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'table'
  const [networkType, setNetworkType] = useState('loading');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState([30, 0]); // World center
  const [mapZoom, setMapZoom] = useState(2);
  
  // Handle both formats
  const locations = data?.locations || data;
  
  // Analyze network type
  useEffect(() => {
    if (locations && Array.isArray(locations)) {
      const isInternal = analyzeNetworkType(locations);
      setNetworkType(isInternal ? 'internal' : 'external');
      
      // Set appropriate map view
      if (!isInternal && locations.length > 0) {
        // For external, center on data
        const avgLat = locations.reduce((sum, l) => sum + (l.lat || 0), 0) / locations.length;
        const avgLng = locations.reduce((sum, l) => sum + (l.lng || 0), 0) / locations.length;
        if (avgLat && avgLng) {
          setMapCenter([avgLat, avgLng]);
          setMapZoom(3);
        }
      }
    }
  }, [locations]);
  
  const analyzeNetworkType = (locs) => {
    if (!locs || locs.length === 0) return true;
    
    const internalCount = locs.filter(loc => {
      if (loc.ip) {
        return isPrivateIP(loc.ip);
      }
      return loc.subnet || loc.vlan;
    }).length;
    
    return internalCount > locs.length / 2;
  };
  
  const isPrivateIP = (ip) => {
    if (!ip) return false;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    const first = parseInt(parts[0]);
    const second = parseInt(parts[1]);
    
    return (first === 10) || 
           (first === 172 && second >= 16 && second <= 31) || 
           (first === 192 && second === 168);
  };
  
  if (!locations || !Array.isArray(locations) || locations.length === 0) {
    return (
      <Card sx={{ height: height }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Network Distribution
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: height - 100 }}>
            <Typography color="text.secondary">Loading network data...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...locations.map(l => l.count));
  const totalCount = locations.reduce((sum, l) => sum + l.count, 0);
  
  // SMTP Relay location (example - should come from config)
  const relayLocation = {
    lat: 40.7128,
    lng: -74.0060,
    name: "SMTP Relay Server"
  };

  // Create custom icons
  const createCustomIcon = (color, size = 10) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  };

  const relayIcon = createCustomIcon(theme.palette.error.main, 16);

  // Internal Network Visualization
  const InternalNetworkView = () => {
    // Group by subnet
    const subnets = {};
    locations.forEach(loc => {
      let subnet = 'Unknown';
      if (loc.ip) {
        const parts = loc.ip.split('.');
        subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
      } else if (loc.subnet) {
        subnet = loc.subnet;
      }
      
      if (!subnets[subnet]) {
        subnets[subnet] = {
          name: subnet,
          devices: [],
          totalCount: 0,
          vlan: loc.vlan || ''
        };
      }
      
      subnets[subnet].devices.push(loc);
      subnets[subnet].totalCount += loc.count;
    });

    return (
      <Box sx={{ p: 2, backgroundColor: theme.palette.background.default, borderRadius: 1 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>Internal Network Mode</AlertTitle>
          Displaying email distribution across {Object.keys(subnets).length} internal subnets
        </Alert>
        
        <Grid container spacing={2}>
          {Object.entries(subnets).map(([subnet, info]) => (
            <Grid item xs={12} sm={6} md={4} key={subnet}>
              <Card 
                sx={{ 
                  height: '100%',
                  borderLeft: `4px solid ${theme.palette.primary.main}`,
                  '&:hover': { boxShadow: 3 }
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Router color="primary" />
                    <Typography variant="subtitle1" fontWeight="bold">
                      {subnet}
                    </Typography>
                  </Stack>
                  
                  {info.vlan && (
                    <Chip label={info.vlan} size="small" color="secondary" sx={{ mb: 1 }} />
                  )}
                  
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Devices:
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {info.devices.length}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">
                        Emails:
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {info.totalCount.toLocaleString()}
                      </Typography>
                    </Box>
                    
                    <LinearProgress
                      variant="determinate"
                      value={(info.totalCount / maxCount) * 100}
                      sx={{ 
                        height: 6, 
                        borderRadius: 3,
                        backgroundColor: theme.palette.grey[200],
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: theme.palette.primary.main
                        }
                      }}
                    />
                    
                    <Typography variant="caption" color="text.secondary">
                      {((info.totalCount / totalCount) * 100).toFixed(1)}% of total traffic
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  // External World Map View
  const ExternalWorldMapView = () => {
    // Calculate connection paths
    const validLocations = locations.filter(loc => loc.lat && loc.lng);
    
    return (
      <Box sx={{ position: 'relative', height: height }}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%', borderRadius: '8px' }}
          scrollWheelZoom={true}
        >
          <MapUpdater center={mapCenter} zoom={mapZoom} />
          
          {/* Map Tiles */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          {/* SMTP Relay Server Marker */}
          <Marker position={[relayLocation.lat, relayLocation.lng]} icon={relayIcon}>
            <Popup>
              <Box sx={{ minWidth: 200 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  {relayLocation.name}
                </Typography>
                <Typography variant="body2">
                  Central SMTP Relay
                </Typography>
                <Chip 
                  label="Active" 
                  size="small" 
                  color="success" 
                  sx={{ mt: 1 }}
                />
              </Box>
            </Popup>
          </Marker>
          
          {/* Connection Lines */}
          {validLocations.map((location, index) => {
            const opacity = 0.3 + (location.count / maxCount) * 0.5;
            const weight = 1 + (location.count / maxCount) * 4;
            
            return (
              <React.Fragment key={index}>
                {/* Curved path from relay to destination */}
                <Polyline
                  positions={[
                    [relayLocation.lat, relayLocation.lng],
                    [location.lat, location.lng]
                  ]}
                  color={theme.palette.primary.main}
                  weight={weight}
                  opacity={opacity}
                  dashArray={selectedLocation === location.country ? "10, 10" : null}
                />
                
                {/* Destination Marker */}
                <CircleMarker
                  center={[location.lat, location.lng]}
                  radius={5 + (location.count / maxCount) * 15}
                  fillColor={theme.palette.success.main}
                  fillOpacity={0.7}
                  color="white"
                  weight={2}
                  eventHandlers={{
                    click: () => setSelectedLocation(location.country),
                    mouseover: (e) => {
                      e.target.setStyle({ fillOpacity: 1 });
                    },
                    mouseout: (e) => {
                      e.target.setStyle({ fillOpacity: 0.7 });
                    }
                  }}
                >
                  <Popup>
                    <Box sx={{ minWidth: 200 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {location.country}
                      </Typography>
                      {location.city && (
                        <Typography variant="body2" color="text.secondary">
                          {location.city}
                        </Typography>
                      )}
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption">Emails:</Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {location.count.toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption">Percentage:</Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {((location.count / totalCount) * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        {location.ip && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption">IP:</Typography>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {location.ip}
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    </Box>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            );
          })}
        </MapContainer>
        
        {/* Map Legend */}
        <Paper
          sx={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            p: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            zIndex: 1000
          }}
        >
          <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 1 }}>
            Legend
          </Typography>
          <Stack spacing={0.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ 
                width: 12, 
                height: 12, 
                borderRadius: '50%', 
                backgroundColor: theme.palette.error.main 
              }} />
              <Typography variant="caption">SMTP Relay</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ 
                width: 12, 
                height: 12, 
                borderRadius: '50%', 
                backgroundColor: theme.palette.success.main 
              }} />
              <Typography variant="caption">Destinations</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ 
                width: 20, 
                height: 2, 
                backgroundColor: theme.palette.primary.main 
              }} />
              <Typography variant="caption">Email Flow</Typography>
            </Box>
          </Stack>
        </Paper>
        
        {/* Stats Overlay */}
        <Paper
          sx={{
            position: 'absolute',
            top: 20,
            right: 20,
            p: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            zIndex: 1000,
            minWidth: 150
          }}
        >
          <Stack spacing={1}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Total Emails
              </Typography>
              <Typography variant="h6">
                {totalCount.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Countries
              </Typography>
              <Typography variant="h6">
                {validLocations.length}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Box>
    );
  };

  // Table View
  const TableView = () => (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Location</TableCell>
            {networkType === 'internal' && <TableCell>IP/Subnet</TableCell>}
            <TableCell align="right">Emails</TableCell>
            <TableCell>Volume</TableCell>
            <TableCell align="right">Share</TableCell>
            <TableCell>Trend</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {locations.map((location, index) => {
            const percentage = (location.count / totalCount) * 100;
            const isTop = index < 3;
            
            return (
              <TableRow 
                key={index} 
                hover
                sx={{
                  backgroundColor: isTop ? alpha(theme.palette.primary.main, 0.05) : 'transparent'
                }}
              >
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Avatar 
                      sx={{ 
                        width: 32, 
                        height: 32,
                        backgroundColor: isTop ? theme.palette.primary.light : theme.palette.grey[300]
                      }}
                    >
                      {networkType === 'internal' ? <Hub /> : <Public />}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={isTop ? 'bold' : 'normal'}>
                        {location.country || location.subnet || location.name || 'Unknown'}
                      </Typography>
                      {location.city && (
                        <Typography variant="caption" color="text.secondary">
                          {location.city}
                        </Typography>
                      )}
                    </Box>
                    {isTop && (
                      <Chip
                        label={`#${index + 1}`}
                        size="small"
                        color="primary"
                      />
                    )}
                  </Stack>
                </TableCell>
                
                {networkType === 'internal' && (
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {location.ip || location.subnet || 'N/A'}
                    </Typography>
                  </TableCell>
                )}
                
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {location.count.toLocaleString()}
                  </Typography>
                </TableCell>
                
                <TableCell>
                  <Box sx={{ width: 100 }}>
                    <LinearProgress
                      variant="determinate"
                      value={(location.count / maxCount) * 100}
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: theme.palette.grey[200],
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: 
                            index === 0 ? theme.palette.success.main :
                            index === 1 ? theme.palette.info.main :
                            index === 2 ? theme.palette.warning.main :
                            theme.palette.primary.main
                        }
                      }}
                    />
                  </Box>
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {percentage.toFixed(1)}%
                  </Typography>
                </TableCell>
                
                <TableCell>
                  {percentage > 10 && (
                    <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Card sx={{ height: 'auto' }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {networkType === 'internal' ? (
            <Business sx={{ mr: 1, color: 'primary.main' }} />
          ) : (
            <Public sx={{ mr: 1, color: 'primary.main' }} />
          )}
          <Typography variant="h6">
            {networkType === 'internal' ? 'Internal Network' : 'Geographic'} Distribution
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          
          {/* View Toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="map">
              <MapIcon sx={{ mr: 0.5 }} />
              {networkType === 'internal' ? 'Network' : 'Map'} View
            </ToggleButton>
            <ToggleButton value="table">
              <TableChart sx={{ mr: 0.5 }} />
              Table View
            </ToggleButton>
          </ToggleButtonGroup>
          
          <Box sx={{ ml: 2 }}>
            <Chip
              icon={networkType === 'internal' ? <Hub /> : <LocationOn />}
              label={`${locations.length} ${networkType === 'internal' ? 'Subnets' : 'Locations'}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Content */}
        {viewMode === 'table' ? (
          <TableView />
        ) : networkType === 'internal' ? (
          <InternalNetworkView />
        ) : (
          <ExternalWorldMapView />
        )}
      </CardContent>
    </Card>
  );
};

// Add missing import
import { alpha } from '@mui/material/styles';
import Grid from '@mui/material/Grid';

export default GeoHeatMap;