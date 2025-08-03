import React, { useState, useEffect } from 'react';
import {
  Shield as ShieldIcon,
  Computer as MonitorIcon,
  Smartphone as SmartphoneIcon,
  Public as GlobeIcon,
  AccessTime as ClockIcon,
  Warning as AlertTriangleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as XCircleIcon,
  Logout as LogOutIcon,
  VpnKey as KeyIcon,
  Refresh as RefreshCwIcon,
  LocationOn as MapPinIcon,
  ShowChart as ActivityIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext-Debug';

const Sessions = () => {
  const [sessions, setSessions] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [backupCodes, setBackupCodes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('sessions');
  const { apiRequest } = useAuth();

  useEffect(() => {
    loadSessions();
    loadSecurityEvents();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await apiRequest('/api/sessions/my-sessions');
      const data = await response.json();
      setSessions(data.sessions);
      setLoading(false);
    } catch (err) {
      setError('Failed to load sessions');
      setLoading(false);
    }
  };

  const loadSecurityEvents = async () => {
    try {
      const response = await apiRequest('/api/sessions/security-events');
      const data = await response.json();
      setSecurityEvents(data.events);
    } catch (err) {
      console.error('Failed to load security events');
    }
  };

  const revokeSession = async (sessionId) => {
    if (!confirm('Are you sure you want to revoke this session?')) return;
    
    try {
      const response = await apiRequest(`/api/sessions/revoke/${sessionId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setSessions(sessions.filter(s => s.id !== sessionId));
      }
    } catch (err) {
      setError('Failed to revoke session');
    }
  };

  const revokeAllSessions = async () => {
    if (!confirm('This will log you out from all other devices. Continue?')) return;
    
    try {
      const response = await apiRequest('/api/sessions/revoke-all', {
        method: 'POST'
      });
      
      if (response.ok) {
        loadSessions();
      }
    } catch (err) {
      setError('Failed to revoke sessions');
    }
  };

  const generateBackupCodes = async () => {
    try {
      const response = await apiRequest('/api/sessions/backup-codes', {
        method: 'POST'
      });
      
      const data = await response.json();
      if (response.ok) {
        setBackupCodes(data.codes);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to generate backup codes');
    }
  };

  const getDeviceIcon = (browser) => {
    if (browser.toLowerCase().includes('mobile')) {
      return <Smartphone className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'LOGIN_SUCCESS':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'LOGIN_FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'SECURITY_ALERT':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Security & Sessions</h1>
              <p className="text-gray-600">Manage your active sessions and security settings</p>
            </div>
          </div>
          <button
            onClick={revokeAllSessions}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out Everywhere Else</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Monitor className="h-5 w-5 text-blue-600" />
              <span className="text-2xl font-bold text-blue-600">{sessions.length}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Active Sessions</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">
                {sessions.filter(s => s.isCurrent).length}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Current Device</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Activity className="h-5 w-5 text-purple-600" />
              <span className="text-2xl font-bold text-purple-600">
                {securityEvents.length}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Recent Events</p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <span className="text-red-800">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'sessions', label: 'Active Sessions', icon: Monitor },
              { id: 'events', label: 'Security Events', icon: Activity },
              { id: 'backup', label: 'Backup Codes', icon: Key }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Sessions Tab */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className={`border rounded-lg p-4 ${
                    session.isCurrent ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getDeviceIcon(session.deviceInfo.browser)}
                      <div>
                        <div className="font-medium text-gray-900">
                          {session.deviceInfo.browser}
                          {session.isCurrent && (
                            <span className="ml-2 text-sm text-blue-600">(This Device)</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 space-x-4">
                          <span className="inline-flex items-center space-x-1">
                            <Globe className="h-3 w-3" />
                            <span>{session.deviceInfo.ip}</span>
                          </span>
                          <span className="inline-flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimeAgo(session.lastUsed)}</span>
                          </span>
                          {session.location && (
                            <span className="inline-flex items-center space-x-1">
                              <MapPin className="h-3 w-3" />
                              <span>{session.location}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <button
                        onClick={() => revokeSession(session.id)}
                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {sessions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No active sessions found
                </div>
              )}
            </div>
          )}

          {/* Security Events Tab */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              {securityEvents.map((event, index) => (
                <div key={index} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                  {getEventIcon(event.type)}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{event.type.replace(/_/g, ' ')}</div>
                    <div className="text-sm text-gray-500">
                      {event.ip} • {event.device} • {formatTimeAgo(event.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              
              {securityEvents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No security events to display
                </div>
              )}
            </div>
          )}

          {/* Backup Codes Tab */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              {!backupCodes ? (
                <div className="text-center py-8">
                  <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Backup Codes</h3>
                  <p className="text-gray-600 mb-6">
                    Generate one-time use backup codes for emergency access when you can't use your authenticator app.
                  </p>
                  <button
                    onClick={generateBackupCodes}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Generate Backup Codes
                  </button>
                </div>
              ) : (
                <div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium mb-1">Important: Save these codes securely!</p>
                        <p>Each code can only be used once. Store them in a safe place like a password manager.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="font-mono text-sm bg-gray-100 rounded-lg p-3 text-center">
                        {code}
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 flex justify-center space-x-4">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(backupCodes.join('\n'));
                        alert('Codes copied to clipboard');
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Copy All
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'backup-codes.txt';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Download
                    </button>
                    <button
                      onClick={generateBackupCodes}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Regenerate</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sessions;