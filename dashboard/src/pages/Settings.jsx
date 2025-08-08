import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab
} from '@mui/material';
import {
  Security as SecurityIcon,
  Settings as SystemIcon
} from '@mui/icons-material';
import SystemConfig from '../components/SystemConfig';
import TLSCertificateManager from '../components/TLSCertificateManager';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Settings() {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Paper elevation={3} sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="TLS Certificates" icon={<SecurityIcon />} />
          <Tab label="System Config" icon={<SystemIcon />} />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <TLSCertificateManager />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <SystemConfig />
      </TabPanel>
    </Box>
  );
}