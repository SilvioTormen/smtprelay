import React, { useState, useEffect } from 'react';
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
  Tooltip,
  IconButton,
  Alert,
  AlertTitle
} from '@mui/material';
import {
  Public,
  Business,
  TableChart,
  Map as MapIcon,
  LocationOn,
  Router,
  Computer,
  Storage,
  Print,
  Scanner,
  Videocam,
  Smartphone,
  Refresh,
  ZoomIn,
  ZoomOut,
  Hub,
  Lan
} from '@mui/icons-material';

const GeoHeatMap = ({ data, height }) => {
  const [viewMode, setViewMode] = useState('auto'); // 'auto', 'map', 'table'
  const [networkType, setNetworkType] = useState('internal'); // 'internal' or 'external'
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapScale, setMapScale] = useState(1);
  
  // Handle both formats: direct array or object with locations property
  const locations = data?.locations || data;
  
  // Analyze IPs to determine if internal or external network
  useEffect(() => {
    if (locations && Array.isArray(locations)) {
      const isInternalNetwork = analyzeNetworkType(locations);
      setNetworkType(isInternalNetwork ? 'internal' : 'external');
      // Auto-select appropriate view
      if (viewMode === 'auto') {
        setViewMode(isInternalNetwork ? 'map' : 'map');
      }
    }
  }, [locations]);
  
  // Check if IPs are internal (RFC1918) or external
  const analyzeNetworkType = (locs) => {
    if (!locs || locs.length === 0) return true;
    
    // Check if we have IP addresses in the data
    const hasInternalIPs = locs.some(loc => {
      // If location has an IP field, check it
      if (loc.ip) {
        return isPrivateIP(loc.ip);
      }
      // If location has subnet information, it's likely internal
      if (loc.subnet || loc.vlan) {
        return true;
      }
      // Check country names for internal indicators
      if (loc.country && (
        loc.country.includes('192.168') ||
        loc.country.includes('10.') ||
        loc.country.includes('172.') ||
        loc.country.includes('Subnet') ||
        loc.country.includes('VLAN')
      )) {
        return true;
      }
      return false;
    });
    
    // If most IPs are internal, treat as internal network
    const internalCount = locs.filter(loc => {
      if (loc.ip) return isPrivateIP(loc.ip);
      if (loc.subnet || loc.vlan) return true;
      return false;
    }).length;
    
    return internalCount > locs.length / 2;
  };
  
  // Check if IP is private (RFC1918)
  const isPrivateIP = (ip) => {
    if (!ip) return false;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    const first = parseInt(parts[0]);
    const second = parseInt(parts[1]);
    
    // 10.0.0.0/8
    if (first === 10) return true;
    // 172.16.0.0/12
    if (first === 172 && second >= 16 && second <= 31) return true;
    // 192.168.0.0/16
    if (first === 192 && second === 168) return true;
    
    return false;
  };
  
  // If no data, show placeholder
  if (!locations || !Array.isArray(locations) || locations.length === 0) {
    return (
      <Card sx={{ height: height || 400 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Network Distribution
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
            <Typography color="text.secondary">Loading network data...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...locations.map(l => l.count));
  const totalCount = locations.reduce((sum, l) => sum + l.count, 0);

  // Internal Network Map - Shows subnets and VLANs
  const InternalNetworkMap = () => {
    const mapWidth = 800;
    const mapHeight = 500;
    
    // Parse and group locations by subnet
    const subnets = {};
    locations.forEach(loc => {
      let subnet = 'Unknown';
      if (loc.ip) {
        const parts = loc.ip.split('.');
        subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
      } else if (loc.subnet) {
        subnet = loc.subnet;
      } else if (loc.country && loc.country.includes('.')) {
        // Country field might contain subnet info
        subnet = loc.country;
      }
      
      if (!subnets[subnet]) {
        subnets[subnet] = {
          name: subnet,
          devices: [],
          totalCount: 0
        };
      }
      
      subnets[subnet].devices.push(loc);
      subnets[subnet].totalCount += loc.count;
    });
    
    const subnetList = Object.values(subnets);
    const numSubnets = subnetList.length;
    
    // Calculate positions for subnets in a circle around the center
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    const radius = 150;
    
    const getSubnetPosition = (index) => {
      const angle = (index * 2 * Math.PI) / numSubnets;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    };
    
    // Device type icons
    const getDeviceIcon = (device) => {
      const type = device.type || device.deviceType || 'unknown';
      const icons = {
        printer: '🖨️',
        scanner: '📠',
        camera: '📹',
        storage: '💾',
        nas: '🗄️',
        computer: '💻',
        server: '🖥️',
        mobile: '📱',
        iot: '📡',
        unknown: '📧'
      };
      return icons[type.toLowerCase()] || icons.unknown;
    };

    return (
      <Box sx={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        {/* Map Controls */}
        <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', gap: 1 }}>
          <IconButton 
            size="small" 
            onClick={() => setMapScale(Math.min(mapScale + 0.2, 2))}
            sx={{ backgroundColor: 'background.paper', boxShadow: 1 }}
          >
            <ZoomIn />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => setMapScale(Math.max(mapScale - 0.2, 0.6))}
            sx={{ backgroundColor: 'background.paper', boxShadow: 1 }}
          >
            <ZoomOut />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => setMapScale(1)}
            sx={{ backgroundColor: 'background.paper', boxShadow: 1 }}
          >
            <Refresh />
          </IconButton>
        </Box>

        {/* Network Type Indicator */}
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>Internal Network View</AlertTitle>
          Showing email distribution across internal subnets and VLANs
        </Alert>

        <svg
          width="100%"
          height={400}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          style={{ backgroundColor: '#f5f5f5' }}
        >
          {/* Grid background */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e0e0e0" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* SMTP Relay at center */}
          <g>
            <circle
              cx={centerX}
              cy={centerY}
              r="40"
              fill="#1976d2"
              stroke="#fff"
              strokeWidth="3"
            />
            <text
              x={centerX}
              y={centerY - 50}
              textAnchor="middle"
              fill="#1976d2"
              fontSize="14"
              fontWeight="bold"
            >
              SMTP Relay
            </text>
            <text
              x={centerX}
              y={centerY}
              textAnchor="middle"
              fill="#fff"
              fontSize="20"
            >
              📧
            </text>
            <text
              x={centerX}
              y={centerY + 20}
              textAnchor="middle"
              fill="#fff"
              fontSize="10"
            >
              Core
            </text>
          </g>

          {/* Subnet nodes and connections */}
          {subnetList.map((subnet, index) => {
            const pos = getSubnetPosition(index);
            const nodeRadius = 20 + (subnet.totalCount / maxCount) * 30;
            
            return (
              <g key={subnet.name}>
                {/* Connection line to center */}
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={pos.x}
                  y2={pos.y}
                  stroke="#90caf9"
                  strokeWidth={Math.max(2, (subnet.totalCount / maxCount) * 8)}
                  strokeDasharray={selectedLocation === subnet.name ? "5,5" : "none"}
                  opacity="0.6"
                >
                  {selectedLocation === subnet.name && (
                    <animate
                      attributeName="stroke-dashoffset"
                      from="10"
                      to="0"
                      dur="0.5s"
                      repeatCount="indefinite"
                    />
                  )}
                </line>

                {/* Subnet circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={nodeRadius}
                  fill="#4caf50"
                  stroke="#fff"
                  strokeWidth="2"
                  opacity="0.8"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setSelectedLocation(subnet.name)}
                  onMouseLeave={() => setSelectedLocation(null)}
                />

                {/* Subnet label */}
                <text
                  x={pos.x}
                  y={pos.y - nodeRadius - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="bold"
                  fill="#333"
                >
                  {subnet.name}
                </text>

                {/* Device count */}
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#fff"
                  fontWeight="bold"
                >
                  {subnet.devices.length} devices
                </text>

                {/* Email count */}
                <text
                  x={pos.x}
                  y={pos.y + 15}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#fff"
                >
                  {subnet.totalCount} emails
                </text>

                {/* Device icons around subnet */}
                {subnet.devices.slice(0, 5).map((device, deviceIndex) => {
                  const deviceAngle = (deviceIndex * 2 * Math.PI) / Math.min(5, subnet.devices.length);
                  const deviceX = pos.x + (nodeRadius + 20) * Math.cos(deviceAngle);
                  const deviceY = pos.y + (nodeRadius + 20) * Math.sin(deviceAngle);
                  
                  return (
                    <g key={deviceIndex}>
                      <circle
                        cx={deviceX}
                        cy={deviceY}
                        r="12"
                        fill="#fff"
                        stroke="#666"
                        strokeWidth="1"
                      />
                      <text
                        x={deviceX}
                        y={deviceY + 4}
                        textAnchor="middle"
                        fontSize="10"
                      >
                        {getDeviceIcon(device)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Legend */}
          <g transform="translate(10, 430)">
            <rect x="0" y="0" width="200" height="60" fill="white" opacity="0.9" rx="5" />
            <circle cx="15" cy="15" r="8" fill="#4caf50" />
            <text x="30" y="18" fontSize="11">Subnet/VLAN</text>
            <circle cx="15" cy="35" r="8" fill="#1976d2" />
            <text x="30" y="38" fontSize="11">SMTP Relay Core</text>
            <line x1="15" y1="50" x2="35" y2="50" stroke="#90caf9" strokeWidth="3" />
            <text x="40" y="53" fontSize="11">Network Traffic</text>
          </g>

          {/* Info box for selected subnet */}
          {selectedLocation && subnets[selectedLocation] && (
            <g transform={`translate(${mapWidth - 220}, 20)`}>
              <rect x="0" y="0" width="200" height="120" fill="white" stroke="#1976d2" strokeWidth="2" rx="5" />
              <text x="10" y="20" fontSize="14" fontWeight="bold" fill="#1976d2">
                {selectedLocation}
              </text>
              <text x="10" y="40" fontSize="12">
                Devices: {subnets[selectedLocation].devices.length}
              </text>
              <text x="10" y="55" fontSize="12">
                Total Emails: {subnets[selectedLocation].totalCount}
              </text>
              <text x="10" y="70" fontSize="12">
                Avg/Device: {Math.round(subnets[selectedLocation].totalCount / subnets[selectedLocation].devices.length)}
              </text>
              <text x="10" y="90" fontSize="10" fill="#666">
                Top Device Types:
              </text>
              <text x="10" y="105" fontSize="10">
                {subnets[selectedLocation].devices.slice(0, 3).map(d => getDeviceIcon(d)).join(' ')}
              </text>
            </g>
          )}
        </svg>
      </Box>
    );
  };

  // External World Map - Shows countries
  const ExternalWorldMap = () => {
    const mapWidth = 800;
    const mapHeight = 400;
    
    // Convert lat/lng to x/y coordinates for SVG
    const latLngToXY = (lat, lng) => {
      const x = (lng + 180) * (mapWidth / 360);
      const y = (90 - lat) * (mapHeight / 180);
      return { x, y };
    };

    // SMTP Relay location (center point)
    const relayLocation = { lat: 40.7128, lng: -74.0060, name: "SMTP Relay" };
    const relayXY = latLngToXY(relayLocation.lat, relayLocation.lng);

    return (
      <Box sx={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        {/* Network Type Indicator */}
        <Alert severity="success" sx={{ mb: 2 }}>
          <AlertTitle>External Network View</AlertTitle>
          Showing email distribution across countries and public IPs
        </Alert>

        <svg
          width="100%"
          height={400}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          style={{ backgroundColor: '#e3f2fd' }}
        >
          {/* Simple world map outline */}
          <rect x="0" y="0" width={mapWidth} height={mapHeight} fill="#e3f2fd" />
          
          {/* Continents (simplified) */}
          <g opacity="0.3">
            <rect x="50" y="60" width="200" height="120" fill="#90caf9" rx="10" />
            <rect x="380" y="80" width="120" height="80" fill="#90caf9" rx="10" />
            <rect x="500" y="60" width="200" height="140" fill="#90caf9" rx="10" />
            <rect x="150" y="200" width="80" height="150" fill="#90caf9" rx="10" />
            <rect x="380" y="170" width="100" height="140" fill="#90caf9" rx="10" />
            <rect x="600" y="250" width="100" height="80" fill="#90caf9" rx="10" />
          </g>

          {/* Connection lines */}
          <g opacity="0.6">
            {locations.map((location, index) => {
              if (!location.lat || !location.lng) return null;
              const destXY = latLngToXY(location.lat, location.lng);
              const strokeWidth = Math.max(1, (location.count / maxCount) * 5);
              
              return (
                <path
                  key={index}
                  d={`M ${relayXY.x} ${relayXY.y} Q ${(relayXY.x + destXY.x) / 2} ${Math.min(relayXY.y, destXY.y) - 50} ${destXY.x} ${destXY.y}`}
                  stroke="#1976d2"
                  strokeWidth={strokeWidth}
                  fill="none"
                  opacity={0.3 + (location.count / maxCount) * 0.7}
                />
              );
            })}
          </g>

          {/* SMTP Relay center */}
          <circle
            cx={relayXY.x}
            cy={relayXY.y}
            r="8"
            fill="#f44336"
            stroke="#fff"
            strokeWidth="2"
          />

          {/* Destination points */}
          {locations.map((location, index) => {
            if (!location.lat || !location.lng) return null;
            const xy = latLngToXY(location.lat, location.lng);
            const radius = 3 + (location.count / maxCount) * 7;
            
            return (
              <circle
                key={index}
                cx={xy.x}
                cy={xy.y}
                r={radius}
                fill="#4caf50"
                stroke="#fff"
                strokeWidth="1.5"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setSelectedLocation(location.country)}
                onMouseLeave={() => setSelectedLocation(null)}
              />
            );
          })}
        </svg>
      </Box>
    );
  };

  // Table View Component
  const TableView = () => (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Location</TableCell>
            {networkType === 'internal' && <TableCell>IP/Subnet</TableCell>}
            <TableCell align="right">Emails</TableCell>
            <TableCell>Distribution</TableCell>
            <TableCell align="right">Percentage</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {locations.map((location, index) => {
            const percentage = (location.count / totalCount) * 100;
            const isTop = index < 3;
            
            return (
              <TableRow key={index} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {networkType === 'internal' ? (
                      <Router sx={{ mr: 1, color: 'primary.main' }} />
                    ) : (
                      <Public sx={{ mr: 1, color: 'primary.main' }} />
                    )}
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
                  </Box>
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
                  <LinearProgress
                    variant="determinate"
                    value={(location.count / maxCount) * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </TableCell>
                
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="medium">
                    {percentage.toFixed(1)}%
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Card sx={{ height: height || 'auto' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          {networkType === 'internal' ? (
            <Business sx={{ mr: 1, color: 'primary.main' }} />
          ) : (
            <Public sx={{ mr: 1, color: 'primary.main' }} />
          )}
          <Typography variant="h6">
            {networkType === 'internal' ? 'Internal Network' : 'Geographic'} Distribution
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          
          {/* View Mode Toggle */}
          <ToggleButtonGroup
            value={viewMode === 'auto' ? 'map' : viewMode}
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
              icon={networkType === 'internal' ? <Hub /> : <Public />}
              label={`${locations.length} ${networkType === 'internal' ? 'Subnets' : 'Countries'}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Content based on view mode and network type */}
        {viewMode === 'table' ? (
          <TableView />
        ) : networkType === 'internal' ? (
          <InternalNetworkMap />
        ) : (
          <ExternalWorldMap />
        )}
      </CardContent>
    </Card>
  );
};

export default GeoHeatMap;