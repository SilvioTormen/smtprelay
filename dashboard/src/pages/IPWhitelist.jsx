import React, { useState, useEffect } from 'react';
import {
  Security as Shield,
  Add as Plus,
  Delete as Trash2,
  Download,
  Upload,
  Search,
  Settings,
  Error as AlertCircle,
  CheckCircle,
  Cancel as XCircle,
  Description as FileText,
  Public as Globe,
  Mail,
  Lock,
  LockOpen as Unlock,
  History,
  ContentCopy as Copy,
  Visibility as Eye,
  VisibilityOff as EyeOff
} from '@mui/icons-material';

const IPWhitelist = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('smtp');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [newIP, setNewIP] = useState('');
  const [importText, setImportText] = useState('');
  const [testIP, setTestIP] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/ip-whitelist/config', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to load configuration');
      
      const data = await response.json();
      setConfig(data.config);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAddIP = async () => {
    if (!newIP || !selectedCategory || !selectedSubcategory) {
      setError('Please fill all fields');
      return;
    }

    try {
      const response = await fetch('/api/ip-whitelist/add', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category: selectedCategory,
          subcategory: selectedSubcategory,
          ip: newIP
        })
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      setSuccess(`Added ${data.ip} successfully`);
      setShowAddModal(false);
      setNewIP('');
      loadConfig();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveIP = async (category, subcategory, ip) => {
    if (!confirm(`Remove ${ip} from ${category}/${subcategory}?`)) return;

    try {
      const response = await fetch('/api/ip-whitelist/remove', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category, subcategory, ip })
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      setSuccess(`Removed ${ip} successfully`);
      loadConfig();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImport = async () => {
    if (!importText || !selectedCategory || !selectedSubcategory) {
      setError('Please fill all fields');
      return;
    }

    const ips = importText.split('\n').map(ip => ip.trim()).filter(Boolean);
    
    try {
      const response = await fetch('/api/ip-whitelist/import', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category: selectedCategory,
          subcategory: selectedSubcategory,
          ips
        })
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      const { results } = data;
      setSuccess(`Import complete: ${results.success.length} added, ${results.skipped.length} skipped, ${results.failed.length} failed`);
      setShowImportModal(false);
      setImportText('');
      loadConfig();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExport = async (category, subcategory) => {
    try {
      const response = await fetch(`/api/ip-whitelist/export/${category}/${subcategory}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      // Create download
      const content = data.ips.join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${category}_${subcategory}_ips.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      setSuccess(`Exported ${data.count} IPs`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTestIP = async () => {
    if (!testIP) {
      setError('Please enter an IP to test');
      return;
    }

    try {
      const response = await fetch('/api/ip-whitelist/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ip: testIP })
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      setTestResults(data);
    } catch (err) {
      setError(err.message);
      setTestResults(null);
    }
  };

  const handleSettingsUpdate = async (setting, value) => {
    try {
      const response = await fetch('/api/ip-whitelist/settings', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [setting]: value })
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      setSuccess('Settings updated successfully');
      loadConfig();
    } catch (err) {
      setError(err.message);
    }
  };

  const loadAuditLog = async () => {
    try {
      const response = await fetch('/api/ip-whitelist/audit?limit=100', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);
      
      setAuditLogs(data.logs);
      setShowAuditModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const filterIPs = (ips) => {
    if (!searchTerm) return ips;
    return ips.filter(ip => ip.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard');
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
              <h1 className="text-2xl font-bold text-gray-900">IP Whitelist Management</h1>
              <p className="text-gray-600">Control access to SMTP relay and dashboard</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowTestModal(true)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center space-x-2"
            >
              <Search className="h-4 w-4" />
              <span>Test IP</span>
            </button>
            <button
              onClick={loadAuditLog}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center space-x-2"
            >
              <History className="h-4 w-4" />
              <span>Audit Log</span>
            </button>
          </div>
        </div>

        {/* Statistics */}
        {config && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Mail className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold text-blue-600">
                  {config.smtp_relay.no_auth_required.length + config.smtp_relay.auth_required.length}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">SMTP Allowed IPs</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Globe className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">
                  {config.frontend_access.allowed.length}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Frontend Allowed IPs</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="text-2xl font-bold text-red-600">
                  {config.blacklist.blocked.length}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Blacklisted IPs</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                {config.settings.enforce_frontend_whitelist ? (
                  <Lock className="h-5 w-5 text-purple-600" />
                ) : (
                  <Unlock className="h-5 w-5 text-purple-600" />
                )}
                <span className="text-sm font-medium text-purple-600">
                  {config.settings.enforce_frontend_whitelist ? 'Enforced' : 'Open'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Frontend Access</p>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <span className="text-red-800">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <span className="text-green-800">{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto text-green-600 hover:text-green-800">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'smtp', label: 'SMTP Relay', icon: Mail },
              { id: 'frontend', label: 'Frontend Access', icon: Globe },
              { id: 'blacklist', label: 'Blacklist', icon: XCircle },
              { id: 'settings', label: 'Settings', icon: Settings }
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
          {/* Search Bar */}
          {activeTab !== 'settings' && (
            <div className="mb-4 flex items-center space-x-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search IPs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              <button
                onClick={() => {
                  setSelectedCategory(
                    activeTab === 'smtp' ? 'smtp_relay' :
                    activeTab === 'frontend' ? 'frontend_access' :
                    'blacklist'
                  );
                  setSelectedSubcategory(
                    activeTab === 'smtp' ? 'no_auth_required' :
                    activeTab === 'frontend' ? 'allowed' :
                    'blocked'
                  );
                  setShowAddModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add IP</span>
              </button>
              <button
                onClick={() => {
                  setSelectedCategory(
                    activeTab === 'smtp' ? 'smtp_relay' :
                    activeTab === 'frontend' ? 'frontend_access' :
                    'blacklist'
                  );
                  setSelectedSubcategory(
                    activeTab === 'smtp' ? 'no_auth_required' :
                    activeTab === 'frontend' ? 'allowed' :
                    'blocked'
                  );
                  setShowImportModal(true);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Import</span>
              </button>
            </div>
          )}

          {/* Content based on active tab */}
          {config && activeTab === 'smtp' && (
            <div className="space-y-6">
              {/* No Auth Required */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center space-x-2">
                    <Unlock className="h-5 w-5 text-green-600" />
                    <span>No Authentication Required</span>
                    <span className="text-sm text-gray-500">({config.smtp_relay.no_auth_required.length})</span>
                  </h3>
                  <button
                    onClick={() => handleExport('smtp_relay', 'no_auth_required')}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export</span>
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  {filterIPs(config.smtp_relay.no_auth_required).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filterIPs(config.smtp_relay.no_auth_required).map(ip => (
                        <div key={ip} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-gray-200">
                          <span className="font-mono text-sm">{ip}</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => copyToClipboard(ip)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveIP('smtp_relay', 'no_auth_required', ip)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No IPs configured</p>
                  )}
                </div>
              </div>

              {/* Auth Required */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center space-x-2">
                    <Lock className="h-5 w-5 text-yellow-600" />
                    <span>Authentication Required</span>
                    <span className="text-sm text-gray-500">({config.smtp_relay.auth_required.length})</span>
                  </h3>
                  <button
                    onClick={() => handleExport('smtp_relay', 'auth_required')}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export</span>
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  {filterIPs(config.smtp_relay.auth_required).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filterIPs(config.smtp_relay.auth_required).map(ip => (
                        <div key={ip} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-gray-200">
                          <span className="font-mono text-sm">{ip}</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => copyToClipboard(ip)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveIP('smtp_relay', 'auth_required', ip)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No IPs configured</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {config && activeTab === 'frontend' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center space-x-2">
                  <Globe className="h-5 w-5 text-blue-600" />
                  <span>Allowed IPs</span>
                  <span className="text-sm text-gray-500">({config.frontend_access.allowed.length})</span>
                </h3>
                <button
                  onClick={() => handleExport('frontend_access', 'allowed')}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </button>
              </div>
              
              {!config.settings.enforce_frontend_whitelist && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="text-yellow-800">
                      Frontend whitelist is not enforced. All IPs can access the dashboard.
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                {filterIPs(config.frontend_access.allowed).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filterIPs(config.frontend_access.allowed).map(ip => (
                      <div key={ip} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-gray-200">
                        <span className="font-mono text-sm">{ip}</span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => copyToClipboard(ip)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveIP('frontend_access', 'allowed', ip)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No IPs configured</p>
                )}
              </div>
            </div>
          )}

          {config && activeTab === 'blacklist' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center space-x-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span>Blocked IPs</span>
                  <span className="text-sm text-gray-500">({config.blacklist.blocked.length})</span>
                </h3>
                <button
                  onClick={() => handleExport('blacklist', 'blocked')}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                {filterIPs(config.blacklist.blocked).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filterIPs(config.blacklist.blocked).map(ip => (
                      <div key={ip} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-gray-200">
                        <span className="font-mono text-sm">{ip}</span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => copyToClipboard(ip)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveIP('blacklist', 'blocked', ip)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No IPs blacklisted</p>
                )}
              </div>
            </div>
          )}

          {config && activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Access Control Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Enforce Frontend Whitelist</label>
                      <p className="text-sm text-gray-500">Only allow whitelisted IPs to access the dashboard</p>
                    </div>
                    <button
                      onClick={() => handleSettingsUpdate('enforce_frontend_whitelist', !config.settings.enforce_frontend_whitelist)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.settings.enforce_frontend_whitelist ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.settings.enforce_frontend_whitelist ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Log Denied Attempts</label>
                      <p className="text-sm text-gray-500">Record all denied access attempts in audit log</p>
                    </div>
                    <button
                      onClick={() => handleSettingsUpdate('log_denied_attempts', !config.settings.log_denied_attempts)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.settings.log_denied_attempts ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.settings.log_denied_attempts ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Auto-block After Failures</label>
                      <p className="text-sm text-gray-500">Number of failed attempts before auto-blacklisting</p>
                    </div>
                    <input
                      type="number"
                      value={config.settings.auto_block_after_failures}
                      onChange={(e) => handleSettingsUpdate('auto_block_after_failures', parseInt(e.target.value))}
                      className="w-20 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h4 className="font-semibold text-blue-900 mb-2">IP Format Examples</h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <div><code className="bg-blue-100 px-2 py-1 rounded">192.168.1.1</code> - Single IP</div>
                  <div><code className="bg-blue-100 px-2 py-1 rounded">10.0.0.0/24</code> - CIDR notation (256 IPs)</div>
                  <div><code className="bg-blue-100 px-2 py-1 rounded">172.16.0.0/12</code> - Large subnet</div>
                  <div><code className="bg-blue-100 px-2 py-1 rounded">2001:db8::/32</code> - IPv6 range</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add IP Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add IP Address</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedSubcategory('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select category...</option>
                  <option value="smtp_relay">SMTP Relay</option>
                  <option value="frontend_access">Frontend Access</option>
                  <option value="blacklist">Blacklist</option>
                </select>
              </div>

              {selectedCategory === 'smtp_relay' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                  <select
                    value={selectedSubcategory}
                    onChange={(e) => setSelectedSubcategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select subcategory...</option>
                    <option value="no_auth_required">No Auth Required</option>
                    <option value="auth_required">Auth Required</option>
                  </select>
                </div>
              )}

              {selectedCategory === 'frontend_access' && (
                <input type="hidden" value="allowed" onChange={() => setSelectedSubcategory('allowed')} />
              )}

              {selectedCategory === 'blacklist' && (
                <input type="hidden" value="blocked" onChange={() => setSelectedSubcategory('blocked')} />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                <input
                  type="text"
                  value={newIP}
                  onChange={(e) => setNewIP(e.target.value)}
                  placeholder="e.g., 192.168.1.1 or 10.0.0.0/24"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewIP('');
                  setSelectedCategory('');
                  setSelectedSubcategory('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddIP}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add IP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Import IP Addresses</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedSubcategory('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select category...</option>
                  <option value="smtp_relay">SMTP Relay</option>
                  <option value="frontend_access">Frontend Access</option>
                  <option value="blacklist">Blacklist</option>
                </select>
              </div>

              {selectedCategory === 'smtp_relay' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                  <select
                    value={selectedSubcategory}
                    onChange={(e) => setSelectedSubcategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select subcategory...</option>
                    <option value="no_auth_required">No Auth Required</option>
                    <option value="auth_required">Auth Required</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IP Addresses (one per line)</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="192.168.1.1&#10;10.0.0.0/24&#10;172.16.0.0/16"
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportText('');
                  setSelectedCategory('');
                  setSelectedSubcategory('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test IP Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Test IP Address</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                <input
                  type="text"
                  value={testIP}
                  onChange={(e) => setTestIP(e.target.value)}
                  placeholder="e.g., 192.168.1.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {testResults && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">IP Type:</span>
                    <span className="text-sm text-gray-900">{testResults.type}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Blacklisted:</span>
                    {testResults.blacklisted ? (
                      <span className="flex items-center space-x-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span>Yes</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>No</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">SMTP Access:</span>
                    {testResults.smtp_access.allowed ? (
                      <span className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>{testResults.smtp_access.requiresAuth ? 'Auth Required' : 'No Auth'}</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span>Denied</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Frontend Access:</span>
                    {testResults.frontend_access ? (
                      <span className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>Allowed</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span>Denied</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowTestModal(false);
                  setTestIP('');
                  setTestResults(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
              <button
                onClick={handleTestIP}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Test IP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Audit Log</h3>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          log.action === 'ADD' ? 'bg-green-100 text-green-800' :
                          log.action === 'REMOVE' ? 'bg-red-100 text-red-800' :
                          log.action === 'DENIED_ACCESS' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {log.category}/{log.subcategory}
                      </td>
                      <td className="px-4 py-2 text-sm font-mono text-gray-900">
                        {log.value}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {log.user}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IPWhitelist;