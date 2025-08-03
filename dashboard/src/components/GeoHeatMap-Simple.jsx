import React from 'react';
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
  Avatar
} from '@mui/material';
import {
  Public,
  LocationOn,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';

const GeoHeatMap = ({ data, height }) => {
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

  // Country flag emoji helper (simplified)
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

  return (
    <Card sx={{ height: height || 'auto' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Public sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">
            Geographic Distribution
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            label={`${locations.length} Countries`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>

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
                    sx={{ 
                      '&:last-child td, &:last-child th': { border: 0 },
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
      </CardContent>
    </Card>
  );
};

export default GeoHeatMap;