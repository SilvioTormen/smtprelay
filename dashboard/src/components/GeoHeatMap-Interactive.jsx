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
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Public,
  TableChart,
  Map as MapIcon,
  LocationOn,
  TrendingUp,
  Refresh,
  ZoomIn,
  ZoomOut
} from '@mui/icons-material';

const GeoHeatMap = ({ data, height }) => {
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'table'
  const [selectedCountry, setSelectedCountry] = useState(null);
  const svgRef = useRef(null);
  const [mapScale, setMapScale] = useState(1);
  
  // Handle both formats: direct array or object with locations property
  const locations = data?.locations || data;
  
  // If no data, show placeholder
  if (!locations || !Array.isArray(locations) || locations.length === 0) {
    return (
      <Card sx={{ height: height || 400 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Geographic Distribution
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
            <Typography color="text.secondary">Loading geographic data...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...locations.map(l => l.count));
  const totalCount = locations.reduce((sum, l) => sum + l.count, 0);

  // Country flag emoji helper
  const getCountryFlag = (country) => {
    const flags = {
      'United States': '🇺🇸',
      'USA': '🇺🇸',
      'Germany': '🇩🇪',
      'United Kingdom': '🇬🇧',
      'UK': '🇬🇧',
      'Japan': '🇯🇵',
      'Australia': '🇦🇺',
      'Canada': '🇨🇦',
      'France': '🇫🇷',
      'India': '🇮🇳',
      'Brazil': '🇧🇷',
      'China': '🇨🇳',
      'Singapore': '🇸🇬',
      'UAE': '🇦🇪',
      'Dubai': '🇦🇪'
    };
    return flags[country] || '🌍';
  };

  // Simple SVG World Map
  const WorldMap = () => {
    const mapWidth = 800;
    const mapHeight = 400;
    
    // Convert lat/lng to x/y coordinates for SVG
    const latLngToXY = (lat, lng) => {
      const x = (lng + 180) * (mapWidth / 360);
      const y = (90 - lat) * (mapHeight / 180);
      return { x, y };
    };

    // SMTP Relay location (center point)
    const relayLocation = { lat: 40.7128, lng: -74.0060, name: "SMTP Relay" }; // New York as example
    const relayXY = latLngToXY(relayLocation.lat, relayLocation.lng);

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

        <svg
          ref={svgRef}
          width="100%"
          height={400}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          style={{ backgroundColor: '#f0f8ff' }}
        >
          {/* Simple world map outline */}
          <rect x="0" y="0" width={mapWidth} height={mapHeight} fill="#e3f2fd" />
          
          {/* Continents (simplified rectangles) */}
          <g opacity="0.3">
            {/* North America */}
            <rect x="50" y="60" width="200" height="120" fill="#90caf9" rx="10" />
            {/* Europe */}
            <rect x="380" y="80" width="120" height="80" fill="#90caf9" rx="10" />
            {/* Asia */}
            <rect x="500" y="60" width="200" height="140" fill="#90caf9" rx="10" />
            {/* South America */}
            <rect x="150" y="200" width="80" height="150" fill="#90caf9" rx="10" />
            {/* Africa */}
            <rect x="380" y="170" width="100" height="140" fill="#90caf9" rx="10" />
            {/* Australia */}
            <rect x="600" y="250" width="100" height="80" fill="#90caf9" rx="10" />
          </g>

          {/* Connection lines from relay to destinations */}
          <g opacity="0.6">
            {locations.map((location, index) => {
              const destXY = latLngToXY(location.lat, location.lng);
              const strokeWidth = Math.max(1, (location.count / maxCount) * 5);
              const opacity = 0.3 + (location.count / maxCount) * 0.7;
              
              return (
                <g key={index}>
                  {/* Curved connection line */}
                  <path
                    d={`M ${relayXY.x} ${relayXY.y} Q ${(relayXY.x + destXY.x) / 2} ${Math.min(relayXY.y, destXY.y) - 50} ${destXY.x} ${destXY.y}`}
                    stroke="#1976d2"
                    strokeWidth={strokeWidth}
                    fill="none"
                    opacity={opacity}
                    strokeDasharray={selectedCountry === location.country ? "5,5" : "none"}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="10"
                      to="0"
                      dur="0.5s"
                      repeatCount="indefinite"
                    />
                  </path>
                </g>
              );
            })}
          </g>

          {/* SMTP Relay center point */}
          <g>
            <circle
              cx={relayXY.x}
              cy={relayXY.y}
              r="8"
              fill="#f44336"
              stroke="#fff"
              strokeWidth="2"
            >
              <animate
                attributeName="r"
                values="8;12;8"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
            <text
              x={relayXY.x}
              y={relayXY.y - 15}
              textAnchor="middle"
              fill="#f44336"
              fontSize="12"
              fontWeight="bold"
            >
              SMTP Relay
            </text>
          </g>

          {/* Destination points */}
          {locations.map((location, index) => {
            const xy = latLngToXY(location.lat, location.lng);
            const radius = 3 + (location.count / maxCount) * 7;
            
            return (
              <g key={index}>
                <circle
                  cx={xy.x}
                  cy={xy.y}
                  r={radius}
                  fill="#4caf50"
                  stroke="#fff"
                  strokeWidth="1.5"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setSelectedCountry(location.country)}
                  onMouseLeave={() => setSelectedCountry(null)}
                />
                {(selectedCountry === location.country || index < 3) && (
                  <>
                    <rect
                      x={xy.x - 40}
                      y={xy.y - 35}
                      width="80"
                      height="25"
                      fill="white"
                      stroke="#1976d2"
                      strokeWidth="1"
                      rx="3"
                      opacity="0.95"
                    />
                    <text
                      x={xy.x}
                      y={xy.y - 20}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {location.city || location.country}
                    </text>
                    <text
                      x={xy.x}
                      y={xy.y - 8}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#666"
                    >
                      {location.count} emails
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Legend */}
          <g transform="translate(10, 350)">
            <rect x="0" y="0" width="150" height="40" fill="white" opacity="0.9" rx="5" />
            <circle cx="15" cy="15" r="4" fill="#4caf50" />
            <text x="25" y="18" fontSize="11">Destinations</text>
            <circle cx="15" cy="28" r="4" fill="#f44336" />
            <text x="25" y="31" fontSize="11">SMTP Relay</text>
            <line x1="80" y1="15" x2="100" y2="15" stroke="#1976d2" strokeWidth="2" />
            <text x="105" y="18" fontSize="11">Email Flow</text>
          </g>
        </svg>

        {/* Selected Country Info */}
        {selectedCountry && (
          <Paper
            sx={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              p: 2,
              maxWidth: 200,
              backgroundColor: 'background.paper',
              boxShadow: 3
            }}
          >
            <Typography variant="subtitle2" fontWeight="bold">
              {getCountryFlag(selectedCountry)} {selectedCountry}
            </Typography>
            {locations.find(l => l.country === selectedCountry) && (
              <>
                <Typography variant="body2">
                  Emails: {locations.find(l => l.country === selectedCountry).count}
                </Typography>
                <Typography variant="body2">
                  {((locations.find(l => l.country === selectedCountry).count / totalCount) * 100).toFixed(1)}% of total
                </Typography>
              </>
            )}
          </Paper>
        )}
      </Box>
    );
  };

  // Table View Component
  const TableView = () => (
    <>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Country</TableCell>
              <TableCell align="right">Emails</TableCell>
              <TableCell>Distribution</TableCell>
              <TableCell align="right">Percentage</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {locations.map((location, index) => {
              const percentage = (location.count / totalCount) * 100;
              const isTopCountry = index < 3;
              
              return (
                <TableRow 
                  key={location.country}
                  hover
                  onClick={() => setSelectedCountry(location.country)}
                  sx={{ 
                    cursor: 'pointer',
                    backgroundColor: isTopCountry ? 'action.hover' : 'transparent'
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ mr: 1 }}>
                        {getCountryFlag(location.country)}
                      </Typography>
                      <Box>
                        <Typography variant="body2" fontWeight={isTopCountry ? 'bold' : 'normal'}>
                          {location.country}
                        </Typography>
                        {location.city && (
                          <Typography variant="caption" color="text.secondary">
                            {location.city}
                          </Typography>
                        )}
                      </Box>
                      {isTopCountry && (
                        <Chip
                          label={`#${index + 1}`}
                          size="small"
                          color="primary"
                          sx={{ ml: 1, height: 20 }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="medium">
                      {location.count.toLocaleString()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 150 }}>
                      <LinearProgress
                        variant="determinate"
                        value={(location.count / maxCount) * 100}
                        sx={{
                          flexGrow: 1,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: theme => theme.palette.grey[200],
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: theme => {
                              if (index === 0) return theme.palette.success.main;
                              if (index === 1) return theme.palette.info.main;
                              if (index === 2) return theme.palette.warning.main;
                              return theme.palette.primary.main;
                            }
                          }
                        }}
                      />
                    </Box>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <Typography variant="body2" fontWeight="medium">
                        {percentage.toFixed(1)}%
                      </Typography>
                      {percentage > 10 && (
                        <TrendingUp sx={{ ml: 0.5, fontSize: 16, color: 'success.main' }} />
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Summary Box */}
      <Box sx={{ 
        mt: 2, 
        p: 2, 
        backgroundColor: 'background.default',
        borderRadius: 1,
        display: 'flex',
        justifyContent: 'space-around'
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Total Countries
          </Typography>
          <Typography variant="h6">
            {locations.length}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Total Emails
          </Typography>
          <Typography variant="h6">
            {totalCount.toLocaleString()}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Top Country
          </Typography>
          <Typography variant="h6">
            {locations[0]?.country || 'N/A'}
          </Typography>
        </Box>
      </Box>
    </>
  );

  return (
    <Card sx={{ height: height || 'auto' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Public sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">
            Geographic Distribution
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          
          {/* View Mode Toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="map">
              <MapIcon sx={{ mr: 0.5 }} />
              Map View
            </ToggleButton>
            <ToggleButton value="table">
              <TableChart sx={{ mr: 0.5 }} />
              Table View
            </ToggleButton>
          </ToggleButtonGroup>
          
          <Box sx={{ ml: 2 }}>
            <Chip
              label={`${locations.length} Countries`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Content based on view mode */}
        {viewMode === 'map' ? <WorldMap /> : <TableView />}
      </CardContent>
    </Card>
  );
};

export default GeoHeatMap;