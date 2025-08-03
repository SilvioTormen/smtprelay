import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  AlertTitle,
  Paper,
  Chip,
  Stack,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Public,
  Error as ErrorIcon,
  CheckCircle,
  Warning
} from '@mui/icons-material';

const GeoHeatMapDebug = ({ data, height = 500 }) => {
  const [debugInfo, setDebugInfo] = useState({});
  
  // Handle both formats
  const locations = data?.locations || data;
  
  useEffect(() => {
    if (locations) {
      // Analyze the data
      const analysis = {
        isArray: Array.isArray(locations),
        count: locations?.length || 0,
        hasLatLng: 0,
        hasIP: 0,
        hasSubnet: 0,
        sampleData: locations?.slice(0, 3) || []
      };
      
      if (Array.isArray(locations)) {
        locations.forEach(loc => {
          if (loc.lat && loc.lng) analysis.hasLatLng++;
          if (loc.ip) analysis.hasIP++;
          if (loc.subnet) analysis.hasSubnet++;
        });
      }
      
      setDebugInfo(analysis);
    }
  }, [locations]);
  
  // Check if data is valid
  const dataStatus = {
    hasData: !!locations,
    isValidArray: Array.isArray(locations) && locations.length > 0,
    hasGeoData: debugInfo.hasLatLng > 0,
    dataType: debugInfo.hasSubnet > 0 ? 'internal' : debugInfo.hasLatLng > 0 ? 'external' : 'unknown'
  };

  return (
    <Card sx={{ height: 'auto' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Geographic Distribution - Debug View
        </Typography>
        
        {/* Data Status */}
        <Alert 
          severity={dataStatus.hasData ? (dataStatus.isValidArray ? 'success' : 'warning') : 'error'}
          sx={{ mb: 2 }}
        >
          <AlertTitle>Data Status</AlertTitle>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {dataStatus.hasData ? <CheckCircle /> : <ErrorIcon />}
              <Typography variant="body2">
                Data received: {dataStatus.hasData ? 'Yes' : 'No'}
              </Typography>
            </Box>
            {dataStatus.hasData && (
              <>
                <Typography variant="body2">
                  Format: {dataStatus.isValidArray ? 'Valid Array' : 'Invalid Format'}
                </Typography>
                <Typography variant="body2">
                  Type: {dataStatus.dataType} network
                </Typography>
                <Typography variant="body2">
                  Locations: {debugInfo.count}
                </Typography>
                <Typography variant="body2">
                  With Lat/Lng: {debugInfo.hasLatLng} / {debugInfo.count}
                </Typography>
                <Typography variant="body2">
                  With IP: {debugInfo.hasIP} / {debugInfo.count}
                </Typography>
                <Typography variant="body2">
                  With Subnet: {debugInfo.hasSubnet} / {debugInfo.count}
                </Typography>
              </>
            )}
          </Stack>
        </Alert>

        {/* Raw Data Preview */}
        <Paper sx={{ p: 2, mb: 2, backgroundColor: 'grey.100' }}>
          <Typography variant="subtitle2" gutterBottom>
            Raw Data Preview (First 3 items):
          </Typography>
          <Box sx={{ 
            fontFamily: 'monospace', 
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 300,
            overflow: 'auto',
            backgroundColor: 'grey.900',
            color: 'grey.100',
            p: 2,
            borderRadius: 1
          }}>
            {JSON.stringify(debugInfo.sampleData, null, 2)}
          </Box>
        </Paper>

        {/* Data Table */}
        {locations && locations.length > 0 && (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Index</TableCell>
                  <TableCell>Country/Name</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell>Lat</TableCell>
                  <TableCell>Lng</TableCell>
                  <TableCell>IP</TableCell>
                  <TableCell>Count</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {locations.slice(0, 10).map((loc, index) => (
                  <TableRow key={index}>
                    <TableCell>{index}</TableCell>
                    <TableCell>{loc.country || loc.name || 'N/A'}</TableCell>
                    <TableCell>{loc.city || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={loc.lat || 'missing'} 
                        size="small"
                        color={loc.lat ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={loc.lng || 'missing'} 
                        size="small"
                        color={loc.lng ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{loc.ip || 'N/A'}</TableCell>
                    <TableCell>{loc.count}</TableCell>
                    <TableCell>
                      {loc.lat && loc.lng ? (
                        <CheckCircle color="success" fontSize="small" />
                      ) : (
                        <Warning color="warning" fontSize="small" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Recommendations */}
        {!dataStatus.hasGeoData && dataStatus.hasData && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <AlertTitle>Missing Geographic Data</AlertTitle>
            <Typography variant="body2">
              The data doesn't contain latitude/longitude coordinates needed for map visualization.
              {debugInfo.hasIP > 0 && ' IP addresses are present but need geolocation lookup.'}
            </Typography>
          </Alert>
        )}

        {/* Test Data Button */}
        <Box sx={{ mt: 2 }}>
          <Button 
            variant="contained" 
            onClick={() => {
              console.log('Full data:', data);
              console.log('Locations:', locations);
              console.log('Debug info:', debugInfo);
            }}
          >
            Log Full Data to Console
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default GeoHeatMapDebug;