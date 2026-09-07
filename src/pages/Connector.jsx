import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Plug, Save, CheckCircle, XCircle, Trash2, Database, Server, Settings, Loader2, Eye, EyeOff } from 'lucide-react';
import ConnectorHistory from './ConnectorHistory';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const Connector = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [allConfigs, setAllConfigs] = useState([]);
  const [selectedConnectionName, setSelectedConnectionName] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(9000);
  const [companyName, setCompanyName] = useState('');
  const [reportName, setReportName] = useState('');
  const [fileFormat, setFileFormat] = useState('XML');
  const [hasConfig, setHasConfig] = useState(false);
  const [status, setStatus] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [connectionState, setConnectionState] = useState('unknown');
  const [isHidingToast, setIsHidingToast] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customRequest, setCustomRequest] = useState('');
  const [responsePayload, setResponsePayload] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [showAddOptions, setShowAddOptions] = useState(false);
  const [isMysqlModalOpen, setIsMysqlModalOpen] = useState(false);
  const [mysqlConfig, setMysqlConfig] = useState({
    host: '',
    port: '',
    username: '',
    password: '',
    database: ''
  });
  const [isMysqlValidating, setIsMysqlValidating] = useState(false);
  const [mysqlConnectionState, setMysqlConnectionState] = useState('unknown');
  const [showPassword, setShowPassword] = useState(false);

  const showToast = (type, msg) => {
    setStatus({ type, msg });
    setIsHidingToast(false);

    setTimeout(() => {
      setIsHidingToast(true);
      setTimeout(() => {
        setStatus(null);
        setIsHidingToast(false);
      }, 300);
    }, 2000);
  };

  useEffect(() => {
    sessionStorage.removeItem('tally_customRequest');
    sessionStorage.removeItem('tally_responsePayload');
    fetchConfig();
  }, []);

  const fetchMysqlConfig = async () => {
    try {
      const res = await axios.get(`${API_URL}/mysql/config`);
      if (res.data) {
        setMysqlConfig({
          host: res.data.host,
          port: res.data.port,
          username: res.data.username,
          password: res.data.password || '',
          database: res.data.database_name
        });

        // Silently validate the saved configuration
        try {
          const validateRes = await axios.post(`${API_URL}/mysql/validate`, {
            host: res.data.host,
            port: Number(res.data.port),
            username: res.data.username,
            password: res.data.password || '',
            database_name: res.data.database_name
          });
          if (validateRes.data && validateRes.data.status === 'SUCCESS') {
            setMysqlConnectionState('connected');
          }
        } catch (e) {
          setMysqlConnectionState('disconnected');
        }
      }
    } catch (err) {
      console.error("Could not fetch MySQL config", err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_URL}/config`);
      if (Array.isArray(res.data)) {
        setAllConfigs(res.data);
      }

      const testName = location.state?.testConnection;
      const configData = Array.isArray(res.data) && res.data.length > 0
        ? (testName ? res.data.find(c => c.connection_name === testName) || res.data[0] : res.data[0])
        : null;

      if (configData && configData.tally_host) {
        setSelectedConnectionName(configData.connection_name);
        setHost(configData.tally_host);
        setPort(configData.tally_port);
        setCompanyName(configData.company_name || '');
        setReportName(configData.report_name || '');
        setFileFormat(configData.file_format || 'XML');

        if (testName || !sessionStorage.getItem('tally_customRequest')) {
          setCustomRequest(configData.request_xml || '');
          sessionStorage.setItem('tally_customRequest', configData.request_xml || '');
        }

        setHasConfig(true);
        checkConnectionStatus();

        if (testName) {
          runAutoTest(testName, configData.tally_host, configData.tally_port, configData.request_xml);
          navigate(location.pathname, { replace: true, state: {} });
        }
      } else {
        setHasConfig(false);
        setHost('localhost');
        setPort(9000);
        setCompanyName('');
        setReportName('');
        setFileFormat('XML');
      }
    } catch (err) {
      console.error("Could not fetch config", err);
    }
  };

  const triggerAutoTest = async (testName) => {
    try {
      const res = await axios.get(`${API_URL}/config`);
      if (Array.isArray(res.data)) {
        setAllConfigs(res.data);
        const configData = testName 
          ? res.data.find(c => c.connection_name === testName)
          : res.data[0];

        if (configData) {
          setSelectedConnectionName(configData.connection_name);
          setHost(configData.tally_host);
          setPort(configData.tally_port);
          setCompanyName(configData.company_name || '');
          setReportName(configData.report_name || '');
          setFileFormat(configData.file_format || 'XML');
          setCustomRequest(configData.request_xml || '');
          setHasConfig(true);

          if (testName) {
            runAutoTest(configData.connection_name, configData.tally_host, configData.tally_port, configData.request_xml);
          }
        } else {
          setHasConfig(false);
          setSelectedConnectionName('');
          setHost('localhost');
          setPort(9000);
          setCompanyName('');
          setReportName('');
          setFileFormat('XML');
          setCustomRequest('');
          setResponsePayload('');
        }
      }
    } catch (err) {
      console.error("Could not fetch config for auto test", err);
    }
  };

  const handleConnectionChange = (e) => {
    const selectedName = e.target.value;
    setSelectedConnectionName(selectedName);
    const configData = allConfigs.find(c => c.connection_name === selectedName);
    if (configData) {
      setHost(configData.tally_host);
      setPort(configData.tally_port);
      setCompanyName(configData.company_name || '');
      setReportName(configData.report_name || '');
      setFileFormat(configData.file_format || 'XML');
      setCustomRequest(configData.request_xml || '');
      sessionStorage.setItem('tally_customRequest', configData.request_xml || '');
    }
  };

  const handleEditConnection = (config) => {
    setConnectionName(config.connection_name);
    setHost(config.tally_host);
    setPort(config.tally_port);
    setCompanyName(config.company_name || '');
    setReportName(config.report_name || '');
    setFileFormat(config.file_format || 'XML');
    setCustomRequest(config.request_xml || '');
    setIsEditMode(true);
    setConnectionState('connected');
    setSyncStatus(null);
    setSyncProgress(0);
    setResponsePayload('');
    setIsModalOpen(true);
  };

  const checkConnectionStatus = async () => {
    try {
      await axios.post(`${API_URL}/sync/test`);
      setConnectionState('connected');
    } catch {
      setConnectionState('disconnected');
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();

    if (!mysqlConfig.host || !mysqlConfig.username || !mysqlConfig.database) {
      showToast('error', 'MySQL Host, Username, and Database are required');
      return;
    }

    setIsLoading(true);
    setStatus(null);
    try {
      // Save MySQL Config
      const mysqlPayload = {
        host: mysqlConfig.host,
        port: Number(mysqlConfig.port),
        username: mysqlConfig.username,
        password: mysqlConfig.password,
        database_name: mysqlConfig.database
      };
      await axios.post(`${API_URL}/mysql/config`, mysqlPayload);

      // Save Tally Config
      const payload = {
        connection_name: connectionName,
        tally_host: host,
        tally_port: port,
        company_name: companyName,
        report_name: reportName,
        file_format: fileFormat,
        request_xml: customRequest
      };

      if (isEditMode) {
        await axios.put(`${API_URL}/config/${connectionName}`, payload);
      } else {
        await axios.post(`${API_URL}/config`, payload);
      }
      showToast('success', isEditMode ? 'Updated Successfully' : 'Saved Successfully');
      setHasConfig(true);
      setIsModalOpen(false);
      setConnectionState('unknown');
      checkConnectionStatus();
      fetchConfig();
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Save Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateConnection = async () => {
    if (!connectionName.trim()) {
      showToast('error', 'Connection Name Required');
      return;
    }

    setIsValidating(true);
    setStatus(null);

    try {
      await axios.post(`${API_URL}/sync/test`, {
        tally_host: host,
        tally_port: port,
        request_xml: ''
      });
      showToast('success', 'Validation Successful!');
      setConnectionState('connected');
    } catch (err) {
      showToast('error', 'Validation Failed!');
      setConnectionState('disconnected');
    } finally {
      setIsValidating(false);
    }
  };

  const handleValidateMysqlConnection = async () => {
    if (!mysqlConfig.host || !mysqlConfig.username || !mysqlConfig.database) {
      showToast('error', 'Host, Username, and Database are required');
      return;
    }

    setIsMysqlValidating(true);
    setStatus(null);
    setMysqlConnectionState('unknown');

    try {
      const payload = {
        host: mysqlConfig.host,
        port: Number(mysqlConfig.port),
        username: mysqlConfig.username,
        password: mysqlConfig.password,
        database_name: mysqlConfig.database
      };

      const res = await axios.post(`${API_URL}/mysql/validate`, payload);
      if (res.data && res.data.status === 'SUCCESS') {
        showToast('success', 'MySQL Validation Successful!');
        setMysqlConnectionState('connected');
      }
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'MySQL Validation Failed!');
      setMysqlConnectionState('disconnected');
    } finally {
      setIsMysqlValidating(false);
    }
  };

  const handleSaveMysqlConnection = async () => {
    if (!mysqlConfig.host || !mysqlConfig.username || !mysqlConfig.database) {
      showToast('error', 'Host, Username, and Database are required');
      return;
    }

    try {
      const payload = {
        host: mysqlConfig.host,
        port: Number(mysqlConfig.port),
        username: mysqlConfig.username,
        password: mysqlConfig.password,
        database_name: mysqlConfig.database
      };

      await axios.post(`${API_URL}/mysql/config`, payload);
      showToast('success', 'MySQL Connection Saved Successfully!');
      setIsMysqlModalOpen(false);
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Failed to save MySQL Connection');
    }
  };

  const handleSendRequest = async (e) => {
    if (e) e.preventDefault();
    setIsModalOpen(false);

    try {
      const payload = {
        connection_name: connectionName,
        tally_host: host,
        tally_port: port,
        company_name: companyName,
        report_name: reportName,
        file_format: fileFormat,
        request_xml: customRequest
      };

      // Save MySQL Config first
      const mysqlPayload = {
        host: mysqlConfig.host,
        port: Number(mysqlConfig.port),
        username: mysqlConfig.username,
        password: mysqlConfig.password,
        database_name: mysqlConfig.database
      };
      await axios.post(`${API_URL}/mysql/config`, mysqlPayload);

      if (isEditMode) {
        await axios.put(`${API_URL}/config/${connectionName}`, payload);
      } else {
        await axios.post(`${API_URL}/config`, payload);
      }
      showToast('success', isEditMode ? 'Updated Successfully' : 'Saved Successfully');

      // Fetch latest config and run the request on main page
      setHistoryRefreshKey(prev => prev + 1);
      triggerAutoTest(connectionName);

    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Operation Failed');
    }
  };

  const runAutoTest = async (testName, testHost, testPort, testXml) => {
    setIsSendingRequest(true);
    setStatus(null);
    setResponsePayload('');
    setSyncProgress(0);
    setSyncStatus('IN_PROGRESS');

    try {
      const res = await axios.post(`${API_URL}/sync/start`, {
        connection_name: testName,
        tally_host: testHost,
        tally_port: testPort,
        request_xml: testXml
      });
      
      const logId = res.data.log_id;
      if (logId) {
        setResponsePayload(`Sync started. log_id: ${logId}\nWaiting for progress...`);
        // Start polling
        const intervalId = setInterval(async () => {
          try {
            const progRes = await axios.get(`${API_URL}/sync/progress/${logId}`);
            const data = progRes.data;
            setSyncProgress(data.records_fetched || 0);
            setSyncStatus(data.status);
            
            if (data.status === 'SUCCESS' || data.status === 'ERROR') {
              clearInterval(intervalId);
              setIsSendingRequest(false);
              setHistoryRefreshKey(prev => prev + 1);
              
              if (data.status === 'SUCCESS') {
                if (data.response_payload) {
                   setResponsePayload(data.response_payload);
                } else {
                   setResponsePayload('');
                }
                showToast('success', `Sync completed successfully - ${data.records_fetched} rows stored.`);
              } else {
                showToast('error', `Sync failed: ${data.message}`);
              }
            }
          } catch (pollErr) {
            clearInterval(intervalId);
            setIsSendingRequest(false);
            setSyncStatus('ERROR');
            setResponsePayload(`Polling error: ${pollErr.message}`);
          }
        }, 1500);
      } else {
         // Fallback if no log_id returned
         setResponsePayload(res.data.response_xml || 'Request successful.');
         setIsSendingRequest(false);
         setSyncStatus('SUCCESS');
      }
    } catch (err) {
      setSyncStatus('ERROR');
      setResponsePayload(`ERROR: ${err.response?.data?.detail || 'Request failed.'}`);
      setIsSendingRequest(false);
      showToast('error', 'Sync Failed');
    }
  };

  const getRequestResponseLayout = (isReadOnly, isEditMode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1, minHeight: '150px', height: isReadOnly ? '300px' : '220px' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '8px' }}>Request:</label>
        <textarea
          style={{
            flex: 1,
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '16px',
            fontFamily: 'monospace',
            color: 'var(--text-primary)',
            resize: 'none'
          }}
          value={customRequest}
          readOnly={isReadOnly}
          onChange={e => setCustomRequest(e.target.value)}
        />
        {!isReadOnly && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                disabled={isSendingRequest}
              >
                {isSendingRequest ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    {isEditMode ? 'Updating...' : 'Sending...'}
                  </>
                ) : (isEditMode ? 'Update Configuration' : 'Send Request')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-color)' }}>Response:</label>
          {syncStatus === 'SUCCESS' && !isSendingRequest && (
            <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Data Preview</span>
          )}
        </div>
        
        {syncStatus === 'SUCCESS' && !isSendingRequest && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ backgroundColor: 'var(--success)', borderRadius: '50%', padding: '4px', display: 'flex' }}>
              <CheckCircle size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.95rem' }}>Sync Completed Successfully!</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{syncProgress.toLocaleString()} records processed and stored.</div>
            </div>
          </div>
        )}

        {syncStatus === 'ERROR' && !isSendingRequest && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ backgroundColor: 'var(--danger)', borderRadius: '50%', padding: '4px', display: 'flex' }}>
              <XCircle size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.95rem' }}>Sync Failed</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>An error occurred during synchronization. Check logs for details.</div>
            </div>
          </div>
        )}

        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <textarea
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '16px',
              fontFamily: 'monospace',
              color: 'var(--text-primary)',
              resize: 'none'
            }}
            readOnly
            value={responsePayload}
          />
          {isSendingRequest && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: '6px',
              zIndex: 10
            }}>
              {syncStatus === 'IN_PROGRESS' ? (
                <div style={{ position: 'relative', width: '60px', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{
                    position: 'absolute',
                    width: '100%', height: '100%',
                    border: '3px solid rgba(59, 130, 246, 0.2)',
                    borderTopColor: 'var(--accent-color)',
                    borderBottomColor: 'var(--accent-color)',
                    borderRadius: '50%',
                    animation: 'spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite'
                  }}></div>
                  <Database size={24} color="var(--accent-color)" />
                </div>
              ) : (
                <div style={{ marginBottom: '16px' }}>
                  {syncStatus === 'SUCCESS' ? <CheckCircle size={40} color="var(--success)" /> : <XCircle size={40} color="var(--danger)" />}
                </div>
              )}
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                {syncStatus === 'IN_PROGRESS' ? 'Sync in progress...' : (syncStatus === 'SUCCESS' ? 'Sync Completed!' : 'Sync Failed')}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px', fontWeight: 500 }}>
                {syncProgress.toLocaleString()} rows processed
              </div>
              {syncStatus === 'IN_PROGRESS' && (
                <div style={{ width: '60%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ 
                    position: 'absolute',
                    height: '100%', 
                    backgroundColor: 'var(--accent-color)', 
                    width: '30%', 
                    borderRadius: '3px',
                    animation: 'slide 1.5s infinite ease-in-out'
                  }}></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', paddingBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Connector Configuration</h1>
        </div>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-primary" onClick={() => {
            setConnectionName('');
            setHost('localhost');
            setPort(9000);
            setCompanyName('');
            setReportName('');
            setFileFormat('XML');
            setIsEditMode(false);
            setConnectionState('unknown');
            setCustomRequest(`<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Data</TYPE>
        <ID>Test Ledger</ID>
    </HEADER>

    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>XML</SVEXPORTFORMAT>
                <SVCURRENTCOMPANY>Test Company</SVCURRENTCOMPANY>
            </STATICVARIABLES>
        </DESC>
    </BODY>
</ENVELOPE>`);
            setResponsePayload('');
            setSyncStatus(null);
            setSyncProgress(0);
            setMysqlConfig({ host: '', port: '', username: '', password: '', database: '' });
            setMysqlConnectionState('unknown');
            setIsModalOpen(true);
          }}>
            Add Connector
          </button>
        </div>
      </div>

      {hasConfig ? (
        <>
          <div style={{ backgroundColor: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Active Connection</h3>
              <div>
                {connectionState === 'connected' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--success)' }}>
                    <span className="blink-dot" style={{ backgroundColor: 'var(--success)' }}></span> Connected
                  </div>
                )}
                {connectionState === 'disconnected' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--danger)' }}>
                    <span className="blink-dot" style={{ backgroundColor: 'var(--danger)' }}></span> Disconnected
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
              {getRequestResponseLayout(true, false)}
            </div>
          </div>


        </>
      ) : (
        <div style={{ backgroundColor: 'var(--bg-panel)', textAlign: 'center', padding: '32px 24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <Server size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px', display: 'inline-block' }} />
          <h3 style={{ marginBottom: '8px', marginTop: 0 }}>No Connector Configured</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Add a new connection to start syncing data from Tally.</p>
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        <ConnectorHistory
          isEmbedded={true}
          onConfigUpdated={triggerAutoTest}
          onRunManualSync={triggerAutoTest}
          onEditConnection={handleEditConnection}
          refreshTrigger={historyRefreshKey}
        />
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <form className="modal-content" style={{ width: '1100px', maxWidth: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onSubmit={handleSendRequest}>
            {/* Header - Fixed */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 24px 16px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', zIndex: 10 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{isEditMode ? 'Edit Connector Configuration' : 'Add New Connector'}</h2>
              <button type="button" className="btn" style={{ background: 'transparent', padding: '8px', color: 'var(--text-secondary)' }} onClick={() => setIsModalOpen(false)}>
                <XCircle size={24} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Connection Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={connectionName}
                    onChange={e => setConnectionName(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-panel)' }}
                    placeholder="e.g. Unique Ledger Sync"
                    disabled={isEditMode}
                  />
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Host</label>
                    <input
                      type="text"
                      className="form-input"
                      value={host}
                      onChange={e => setHost(e.target.value)}
                      style={{ height: '44px', backgroundColor: 'var(--bg-panel)' }}
                      placeholder="localhost"
                    />
                  </div>
                  <div style={{ width: '150px' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Port</label>
                    <input
                      type="number"
                      className="form-input"
                      value={port}
                      onChange={e => setPort(e.target.value === '' ? '' : Number(e.target.value))}
                      style={{ height: '44px', backgroundColor: 'var(--bg-panel)' }}
                      placeholder="9000"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleValidateConnection}
                      className="btn btn-primary"
                      style={{
                        height: '44px',
                        padding: '0 24px',
                        backgroundColor: connectionState === 'connected' ? 'var(--success)' : '',
                        borderColor: connectionState === 'connected' ? 'var(--success)' : '',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                      }}
                      disabled={isValidating || connectionState === 'connected'}
                    >
                      {isValidating && <Loader2 size={16} className="spin" />}
                      {!isValidating && connectionState === 'connected' && <CheckCircle size={16} />}
                      {isValidating ? 'Validating...' : (connectionState === 'connected' ? 'Validated' : 'Validate Connection ↗')}
                    </button>
                  </div>
                  <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ height: '20px' }}></div>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Payload Format</label>
                    <select
                      value={fileFormat}
                      onChange={e => setFileFormat(e.target.value)}
                      className="form-input"
                      style={{ height: '44px', backgroundColor: 'var(--bg-panel)' }}
                    >
                      <option value="XML">XML</option>
                      <option value="JSON">JSON</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Company Name</label>
                    <input className="form-input" value={companyName} onChange={e => setCompanyName(e.target.value)} style={{ backgroundColor: 'var(--bg-panel)' }} placeholder="e.g. Acme Corp" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Report Name</label>
                    <input className="form-input" value={reportName} onChange={e => setReportName(e.target.value)} style={{ backgroundColor: 'var(--bg-panel)' }} placeholder="e.g. Trial Balance" />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '16px' }}>
                {getRequestResponseLayout(false, isEditMode)}
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Target Database Configuration</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">MySQL Host</label>
                    <input
                      type="text"
                      className="form-input"
                      value={mysqlConfig.host}
                      onChange={e => {
                        setMysqlConfig({ ...mysqlConfig, host: e.target.value });
                        setMysqlConnectionState('unknown');
                      }}
                      style={{ backgroundColor: 'var(--bg-panel)' }}
                      placeholder="e.g. 127.0.0.1"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Port</label>
                    <input
                      type="number"
                      className="form-input"
                      value={mysqlConfig.port}
                      onChange={e => {
                        setMysqlConfig({ ...mysqlConfig, port: e.target.value === '' ? '' : Number(e.target.value) });
                        setMysqlConnectionState('unknown');
                      }}
                      style={{ backgroundColor: 'var(--bg-panel)' }}
                      placeholder="3306"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-input"
                      value={mysqlConfig.username}
                      onChange={e => {
                        setMysqlConfig({ ...mysqlConfig, username: e.target.value });
                        setMysqlConnectionState('unknown');
                      }}
                      style={{ backgroundColor: 'var(--bg-panel)' }}
                      placeholder="Enter username"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="form-input"
                        value={mysqlConfig.password}
                        onChange={e => {
                          setMysqlConfig({ ...mysqlConfig, password: e.target.value });
                          setMysqlConnectionState('unknown');
                        }}
                        style={{ backgroundColor: 'var(--bg-panel)', paddingRight: '40px' }}
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Database Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={mysqlConfig.database}
                      onChange={e => {
                        setMysqlConfig({ ...mysqlConfig, database: e.target.value });
                        setMysqlConnectionState('unknown');
                      }}
                      style={{ backgroundColor: 'var(--bg-panel)' }}
                      placeholder="e.g. my_database"
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 0 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleValidateMysqlConnection}
                      disabled={isMysqlValidating || mysqlConnectionState === 'connected'}
                      style={{
                        width: '100%',
                        height: '44px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: mysqlConnectionState === 'connected' ? 'var(--success)' : '',
                        borderColor: mysqlConnectionState === 'connected' ? 'var(--success)' : ''
                      }}
                    >
                      {isMysqlValidating && <Loader2 size={16} className="spin" />}
                      {!isMysqlValidating && mysqlConnectionState === 'connected' && <CheckCircle size={16} />}
                      {isMysqlValidating ? 'Validating...' : (mysqlConnectionState === 'connected' ? 'Database Validated' : 'Validate Database ↗')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {status && (
        <div className={`toast ${isHidingToast ? 'hiding' : ''}`} style={{
          backgroundColor: status.type === 'success' ? 'var(--bg-panel)' : 'var(--bg-panel)',
          color: status.type === 'success' ? 'var(--success)' : 'var(--danger)',
          borderLeft: `4px solid ${status.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999
        }}>
          {status.type === 'success' ? <CheckCircle size={24} /> : <XCircle size={24} />}
          <span style={{ fontWeight: 500 }}>{status.msg}</span>
        </div>
      )}
    </div>
  );
};

export default Connector;
