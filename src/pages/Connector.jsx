import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Plug, Save, CheckCircle, XCircle, Trash2, Database, Server, Settings, Loader2, Eye, EyeOff, Clock } from 'lucide-react';
import ConnectorHistory from './ConnectorHistory';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Auto-generate clean database name from company name
const generateDbName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 64);
};

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
  const [dynamicFiltersStr, setDynamicFiltersStr] = useState('{\n  "FROM_DATE": "2024-04-01",\n  "TO_DATE": "2025-03-31"\n}');
  const [responsePayload, setResponsePayload] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [baselineTally, setBaselineTally] = useState(null);
  const [baselineMysql, setBaselineMysql] = useState(null);

  const [showAddOptions, setShowAddOptions] = useState(false);
  const [isMysqlModalOpen, setIsMysqlModalOpen] = useState(false);
  const [mysqlConfig, setMysqlConfig] = useState({
    db_type: 'mysql',
    host: '',
    port: '',
    username: '',
    password: '',
    database: ''
  });
  const [isDbCustomized, setIsDbCustomized] = useState(false);
  const [isMysqlValidating, setIsMysqlValidating] = useState(false);
  const [mysqlConnectionState, setMysqlConnectionState] = useState('unknown');
  const [showPassword, setShowPassword] = useState(false);
  const [isSchedulerActive, setIsSchedulerActive] = useState(false);
  const [schedulerInterval, setSchedulerInterval] = useState('5');

  // Auto-suggest DB name based on Company Name (user can still freely change it)
  useEffect(() => {
    if (!isEditMode && !isDbCustomized && companyName) {
      const autoDb = generateDbName(companyName);
      setMysqlConfig(prev => ({ ...prev, database: autoDb }));
    }
  }, [companyName, isEditMode, isDbCustomized]);

  const isMysqlConfigMatchingExisting = (cfg) => {
    // Automatic validation is ONLY for 2nd time connector onwards (when at least one connection exists in allConfigs)
    if (!cfg || !cfg.database || !Array.isArray(allConfigs) || allConfigs.length === 0) {
      return false;
    }
    
    if (!baselineMysql || !baselineMysql.host) {
      return false;
    }

    const typeMatch = (cfg.db_type || 'mysql') === (baselineMysql.db_type || 'mysql');
    const hostMatch = String(cfg.host || '').trim() === String(baselineMysql.host || '').trim();
    const portMatch = Number(cfg.port || 0) === Number(baselineMysql.port || 0);
    const userMatch = String(cfg.username || '').trim() === String(baselineMysql.username || '').trim();
    const passMatch = String(cfg.password || '') === String(baselineMysql.password || '');

    if (!typeMatch || !hostMatch || !portMatch || !userMatch || !passMatch) {
      return false;
    }

    // Check if baseline database matches
    if (baselineMysql.database && String(cfg.database).trim().toLowerCase() === String(baselineMysql.database).trim().toLowerCase()) {
      return true;
    }

    // Check if any existing connection in allConfigs used this database
    const hasSameDbInConfigs = allConfigs.some(c => {
      const cDb = c.database_name;
      return cDb && String(cDb).trim().toLowerCase() === String(cfg.database).trim().toLowerCase();
    });

    return hasSameDbInConfigs;
  };

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
    fetchMysqlConfig();
  }, []);

  const fetchMysqlConfig = async () => {
    try {
      const res = await axios.get(`${API_URL}/mysql/config`);
      if (res.data) {
        const configData = {
          db_type: res.data.db_type || 'mysql',
          host: res.data.host || '',
          port: res.data.port || '',
          username: res.data.username || '',
          password: res.data.password || '',
          database: res.data.database_name || ''
        };
        setBaselineMysql(configData);
      }
    } catch (err) {
      console.error("Could not fetch database config", err);
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
        setBaselineTally({ host: configData.tally_host, port: configData.tally_port });

        if (testName || !sessionStorage.getItem('tally_customRequest')) {
          setCustomRequest(configData.request_xml || '');
          sessionStorage.setItem('tally_customRequest', configData.request_xml || '');
        }
        
        setDynamicFiltersStr(configData.dynamic_filters ? JSON.stringify(configData.dynamic_filters, null, 2) : '');

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
        setBaselineTally(null);
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
          setDynamicFiltersStr('{\n  "FROM_DATE": "2024-04-01",\n  "TO_DATE": "2025-03-31"\n}');
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
      setDynamicFiltersStr(configData.dynamic_filters ? JSON.stringify(configData.dynamic_filters, null, 2) : '{\n  "FROM_DATE": "2024-04-01",\n  "TO_DATE": "2025-03-31"\n}');
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
    setDynamicFiltersStr(config.dynamic_filters ? JSON.stringify(config.dynamic_filters, null, 2) : '');
    const timing = (config.scheduler_timing || '').trim().toLowerCase();
    const isAct = Boolean(timing && !['inactive', 'off', '0', 'none', ''].includes(timing));
    setIsSchedulerActive(isAct);
    setSchedulerInterval(isAct && timing.match(/^\d+$/) ? timing : '5');
    setIsEditMode(true);
    setIsDbCustomized(true);
    setConnectionState('connected');
    setBaselineTally({ host: config.tally_host, port: config.tally_port });

    if (baselineMysql && baselineMysql.host) {
      setMysqlConfig({
        ...baselineMysql,
        db_type: config.db_type || baselineMysql.db_type || 'mysql',
        database: config.database_name || baselineMysql.database || ''
      });
      setMysqlConnectionState('connected');
    } else {
      setMysqlConnectionState('connected');
    }

    setSyncStatus(null);
    setSyncProgress(0);
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

    if (!connectionName || !connectionName.trim()) {
      showToast('error', 'Connection Name is required');
      return;
    }

    if (!mysqlConfig.host || !mysqlConfig.username || !mysqlConfig.database) {
      showToast('error', 'Database Host, Username, and Database are required');
      return;
    }

    setIsLoading(true);
    setStatus(null);
    try {
      // Save Target Database Config
      const mysqlPayload = {
        db_type: mysqlConfig.db_type || 'mysql',
        host: mysqlConfig.host,
        port: Number(mysqlConfig.port),
        username: mysqlConfig.username,
        password: mysqlConfig.password,
        database_name: mysqlConfig.database
      };
      await axios.post(`${API_URL}/mysql/config`, mysqlPayload);

      let parsedFilters = null;
      if (dynamicFiltersStr && dynamicFiltersStr.trim()) {
        try {
          parsedFilters = JSON.parse(dynamicFiltersStr);
        } catch (e) {
          showToast('error', 'Dynamic Filters must be valid JSON');
          setIsLoading(false);
          return;
        }
      }

      // Save Tally Config
      const payload = {
        connection_name: connectionName,
        tally_host: host,
        tally_port: port,
        company_name: companyName,
        report_name: reportName,
        file_format: fileFormat,
        request_xml: customRequest,
        scheduler_timing: isSchedulerActive ? schedulerInterval : 'inactive',
        dynamic_filters: parsedFilters,
        database_name: mysqlConfig.database
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
      setBaselineTally({ host, port });
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Validation Failed!');
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
        db_type: mysqlConfig.db_type || 'mysql',
        host: mysqlConfig.host,
        port: Number(mysqlConfig.port),
        username: mysqlConfig.username,
        password: mysqlConfig.password,
        database_name: mysqlConfig.database
      };

      const res = await axios.post(`${API_URL}/mysql/validate`, payload);
      if (res.data && res.data.status === 'SUCCESS') {
        showToast('success', res.data.message || 'Database Validated Successfully!');
        setMysqlConnectionState('connected');
        setBaselineMysql({ ...mysqlConfig, port: Number(mysqlConfig.port) });
      }
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Database Validation Failed!');
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
        db_type: mysqlConfig.db_type || 'mysql',
        host: mysqlConfig.host,
        port: Number(mysqlConfig.port),
        username: mysqlConfig.username,
        password: mysqlConfig.password,
        database_name: mysqlConfig.database
      };

      await axios.post(`${API_URL}/mysql/config`, payload);
      showToast('success', 'Database Connection Saved Successfully!');
      setIsMysqlModalOpen(false);
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Failed to save Database Connection');
    }
  };

  const handleSendRequest = async (e) => {
    if (e) e.preventDefault();

    if (!connectionName || !connectionName.trim()) {
      showToast('error', 'Connection Name is required');
      return;
    }

    setIsModalOpen(false);

    try {
      let parsedFilters = null;
      if (dynamicFiltersStr && dynamicFiltersStr.trim()) {
        try {
          parsedFilters = JSON.parse(dynamicFiltersStr);
        } catch (e) {
          showToast('error', 'Dynamic Filters must be valid JSON');
          return;
        }
      }

      const payload = {
        connection_name: connectionName,
        tally_host: host,
        tally_port: port,
        company_name: companyName,
        report_name: reportName,
        file_format: fileFormat,
        request_xml: customRequest,
        scheduler_timing: isSchedulerActive ? schedulerInterval : 'inactive',
        dynamic_filters: parsedFilters,
        database_name: mysqlConfig.database
      };

      // Save Target Database Config first
      const mysqlPayload = {
        db_type: mysqlConfig.db_type || 'mysql',
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

    try {
      const res = await axios.post(`${API_URL}/sync/start`, {
        connection_name: testName,
        tally_host: testHost,
        tally_port: testPort,
        request_xml: testXml
      });
      
      const logId = res.data.log_id;
      if (logId) {
        setResponsePayload(`Sync initiated in background... Please wait...`);
        showToast('success', 'Sync Started in Background');
        
        const pollProgress = async () => {
          try {
            const progressRes = await axios.get(`${API_URL}/sync/progress/${logId}`);
            if (progressRes.data.status === 'IN_PROGRESS') {
              setTimeout(pollProgress, 2000);
            } else {
              if (progressRes.data.status === 'SUCCESS') {
                showToast('success', 'Sync Completed Successfully!');
                setResponsePayload('Successfully completed');
              } else {
                showToast('error', 'Sync Failed');
                setResponsePayload(`ERROR: ${progressRes.data.message || 'Unknown error'}`);
              }
              setHistoryRefreshKey(prev => prev + 1);
              setIsSendingRequest(false);
            }
          } catch (e) {
            console.error("Polling error", e);
            showToast('error', 'Error checking sync status');
            setIsSendingRequest(false);
          }
        };
        
        setTimeout(pollProgress, 2000);
        return; // Exit early, polling will handle the rest
      } else {
         setResponsePayload(res.data.response_xml || 'Request successful.');
         setHistoryRefreshKey(prev => prev + 1);
         setIsSendingRequest(false);
      }
    } catch (err) {
      setResponsePayload(`ERROR: ${err.response?.data?.detail || 'Request failed.'}`);
      showToast('error', 'Sync Failed');
      setIsSendingRequest(false);
    }
  };

  const getRequestResponseLayout = (isReadOnly, isEditMode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1, minHeight: '220px', height: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-color)' }}>Request XML:</label>
        </div>
        <textarea
          style={{
            flex: 1,
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '16px',
            fontFamily: 'monospace',
            color: 'var(--text-primary)',
            resize: 'vertical',
            minHeight: '200px'
          }}
          value={customRequest}
          readOnly={isReadOnly}
          onChange={e => setCustomRequest(e.target.value)}
          placeholder={`<ENVELOPE>\n  <HEADER>\n    <VERSION>1</VERSION>\n    <TALLYREQUEST>EXPORT</TALLYREQUEST>\n    <TYPE>DATA</TYPE>\n    <ID>VCHLEVEL</ID>\n  </HEADER>\n  <BODY>\n    <DESC>\n        <STATICVARIABLES>\n            <SVEXPORTFORMAT>XML</SVEXPORTFORMAT>\n            <SVCURRENTCOMPANY>{COMPANY_NAME}</SVCURRENTCOMPANY>\n            <VARALTERID>{LAST_ALTER_ID}</VARALTERID>\n        </STATICVARIABLES>\n    </DESC>\n  </BODY>\n</ENVELOPE>`}
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
        </div>

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
            value={isReadOnly ? responsePayload : ''}
          />
        </div>
      </div>
    </div>
  );

  const handleMysqlChange = (field, value) => {
    const updated = { ...mysqlConfig, [field]: value };
    setMysqlConfig(updated);
    if (isMysqlConfigMatchingExisting(updated)) {
      setMysqlConnectionState('connected');
    } else {
      setMysqlConnectionState('unknown');
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', paddingBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Connector Configuration</h1>
        </div>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-primary" onClick={() => {
            setConnectionName('');
            setReportName('');
            setFileFormat('XML');
            setIsSchedulerActive(false);
            setSchedulerInterval('5');
            setIsEditMode(false);
            setIsDbCustomized(false);

            let currentHost = 'localhost';
            let currentPort = 9000;
            let isCopied = false;
            
            // Retain last used company name if available, user can still freely change it
            let retainedCompany = '';
            if (allConfigs && allConfigs.length > 0) {
              // 2nd time onwards: retain Tally Host/Port, Company Name & Database credentials
              currentHost = allConfigs[0].tally_host || 'localhost';
              currentPort = allConfigs[0].tally_port || 9000;
              retainedCompany = allConfigs[0].company_name || '';
              isCopied = true;

              const autoDb = retainedCompany ? generateDbName(retainedCompany) : (allConfigs[0].database_name || '');
              if (baselineMysql && baselineMysql.host) {
                setMysqlConfig({
                  ...baselineMysql,
                  db_type: baselineMysql.db_type || 'mysql',
                  database: autoDb
                });
                setMysqlConnectionState('unknown');
              } else {
                setMysqlConfig({ db_type: 'mysql', host: '', port: '3306', username: '', password: '', database: autoDb });
                setMysqlConnectionState('unknown');
              }
            } else {
              // 1st time: retain current companyName if user already typed it
              retainedCompany = companyName || '';
              const autoDb = retainedCompany ? generateDbName(retainedCompany) : '';
              setMysqlConfig({ db_type: 'mysql', host: '', port: '3306', username: '', password: '', database: autoDb });
              setMysqlConnectionState('unknown');
            }
            
            setCompanyName(retainedCompany);
            
            setHost(currentHost);
            setPort(currentPort);
            setBaselineTally(isCopied ? { host: currentHost, port: currentPort } : null);
            setConnectionState(isCopied ? 'connected' : 'unknown');
            setCustomRequest(`<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>EXPORT</TALLYREQUEST>
    <TYPE>DATA</TYPE>
    <ID>VCHLEVEL</ID>
  </HEADER>
  <BODY>
    <DESC>
        <STATICVARIABLES>
            <SVEXPORTFORMAT>XML</SVEXPORTFORMAT>
            <SVCURRENTCOMPANY>{COMPANY_NAME}</SVCURRENTCOMPANY>
            <VARALTERID>{LAST_ALTER_ID}</VARALTERID>
        </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`);
            setSyncStatus(null);
            setSyncProgress(0);
            
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
            <div style={{ padding: '24px 24px 20px 24px', overflowY: 'auto', flex: 1 }}>
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
                      onChange={e => {
                        const newHost = e.target.value;
                        setHost(newHost);
                        if (baselineTally && newHost === baselineTally.host && Number(port) === Number(baselineTally.port)) {
                          setConnectionState('connected');
                        } else {
                          setConnectionState('unknown');
                        }
                      }}
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
                      onChange={e => {
                        const newPort = e.target.value === '' ? '' : Number(e.target.value);
                        setPort(newPort);
                        if (baselineTally && host === baselineTally.host && Number(newPort) === Number(baselineTally.port)) {
                          setConnectionState('connected');
                        } else {
                          setConnectionState('unknown');
                        }
                      }}
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Company Name</label>
                    <input className="form-input" value={companyName} onChange={e => setCompanyName(e.target.value)} style={{ backgroundColor: 'var(--bg-panel)', height: '44px' }} placeholder="e.g. Acme Corp" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Report Name</label>
                    <input className="form-input" value={reportName} onChange={e => setReportName(e.target.value)} style={{ backgroundColor: 'var(--bg-panel)', height: '44px' }} placeholder="e.g. Trial Balance" />
                  </div>

                  {/* Auto Sync Scheduler inline */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={15} style={{ color: isSchedulerActive ? 'var(--success)' : 'var(--text-secondary)' }} />
                        Auto Sync Scheduler
                      </label>
                      {isSchedulerActive && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="blink-dot" style={{ backgroundColor: 'var(--success)', width: '6px', height: '6px' }}></span>
                          Active
                        </span>
                      )}
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      height: '44px',
                      backgroundColor: 'var(--bg-panel)',
                      border: isSchedulerActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      transition: 'all 0.2s ease'
                    }}>
                      {/* Animated Toggle Switch */}
                      <div
                        role="switch"
                        aria-checked={isSchedulerActive}
                        tabIndex={0}
                        onClick={() => setIsSchedulerActive(!isSchedulerActive)}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            setIsSchedulerActive(!isSchedulerActive);
                          }
                        }}
                        style={{
                          width: '42px',
                          height: '24px',
                          backgroundColor: isSchedulerActive ? 'var(--success)' : 'rgba(156, 163, 175, 0.25)',
                          borderRadius: '24px',
                          padding: '2px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'all 0.25s ease',
                          flexShrink: 0,
                          border: isSchedulerActive ? '1px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(156, 163, 175, 0.4)',
                          boxShadow: isSchedulerActive ? '0 0 8px rgba(16, 185, 129, 0.35)' : 'none',
                          outline: 'none'
                        }}
                        title={isSchedulerActive ? 'Click to Turn OFF Auto Sync' : 'Click to Turn ON Auto Sync'}
                      >
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            backgroundColor: '#ffffff',
                            borderRadius: '50%',
                            transform: isSchedulerActive ? 'translateX(18px)' : 'translateX(0px)',
                            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isSchedulerActive ? 'var(--success)' : 'var(--text-secondary)', minWidth: '32px' }}>
                        {isSchedulerActive ? 'ON' : 'OFF'}
                      </span>

                      {isSchedulerActive ? (
                        <select
                          value={schedulerInterval}
                          onChange={e => setSchedulerInterval(e.target.value)}
                          className="form-input"
                          style={{
                            flex: 1,
                            height: '34px',
                            padding: '0 6px',
                            fontSize: '0.825rem',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}
                          title="Sync Interval"
                        >
                          <option value="5" style={{ color: '#000', backgroundColor: '#fff' }}>every 5 mins</option>
                          <option value="15" style={{ color: '#000', backgroundColor: '#fff' }}>every 15 mins</option>
                          <option value="30" style={{ color: '#000', backgroundColor: '#fff' }}>every 30 mins</option>
                          <option value="60" style={{ color: '#000', backgroundColor: '#fff' }}>every 1 hour</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', paddingLeft: '4px' }}>
                          Manual sync only
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '16px' }}>
                {getRequestResponseLayout(false, isEditMode)}
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Target Database Configuration</h3>
                
                {/* Row 1: DB Type, Host, Port, Username */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Database Type</label>
                    <select
                      className="form-input"
                      value={mysqlConfig.db_type || 'mysql'}
                      onChange={e => {
                        const newType = e.target.value;
                        let newPort = mysqlConfig.port;
                        if (newType === 'sqlserver' && (Number(newPort) === 3306 || !newPort)) {
                          newPort = 1433;
                        } else if (newType === 'mysql' && (Number(newPort) === 1433 || !newPort)) {
                          newPort = 3306;
                        }
                        const updated = { ...mysqlConfig, db_type: newType, port: newPort };
                        setMysqlConfig(updated);
                        if (isMysqlConfigMatchingExisting(updated)) {
                          setMysqlConnectionState('connected');
                        } else {
                          setMysqlConnectionState('unknown');
                        }
                      }}
                      style={{ backgroundColor: 'var(--bg-panel)', height: '44px' }}
                    >
                      <option value="mysql">MySQL</option>
                      <option value="sqlserver">SQL Server (MSSQL)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{mysqlConfig.db_type === 'sqlserver' ? 'SQL Server Host' : 'MySQL Host'}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={mysqlConfig.host}
                      onChange={e => handleMysqlChange('host', e.target.value)}
                      style={{ backgroundColor: 'var(--bg-panel)' }}
                      placeholder={mysqlConfig.db_type === 'sqlserver' ? 'e.g. localhost or 127.0.0.1' : 'e.g. 127.0.0.1'}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Port</label>
                    <input
                      type="number"
                      className="form-input"
                      value={mysqlConfig.port}
                      onChange={e => handleMysqlChange('port', e.target.value === '' ? '' : Number(e.target.value))}
                      style={{ backgroundColor: 'var(--bg-panel)' }}
                      placeholder={mysqlConfig.db_type === 'sqlserver' ? '1433' : '3306'}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-input"
                      value={mysqlConfig.username}
                      onChange={e => handleMysqlChange('username', e.target.value)}
                      style={{ backgroundColor: 'var(--bg-panel)' }}
                      placeholder={mysqlConfig.db_type === 'sqlserver' ? 'e.g. sa' : 'e.g. root'}
                    />
                  </div>
                </div>

                {/* Row 2: Password, Database Name (Wider), Validate Button */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(320px, 2.5fr) minmax(180px, auto)', gap: '16px', marginTop: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        className="form-input"
                        value={mysqlConfig.password}
                        onChange={e => handleMysqlChange('password', e.target.value)}
                        style={{ backgroundColor: 'var(--bg-panel)', paddingRight: '40px' }}
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      Database Name <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={mysqlConfig.database}
                      onChange={e => {
                        setIsDbCustomized(true);
                        handleMysqlChange('database', e.target.value);
                      }}
                      style={{
                        backgroundColor: 'var(--bg-panel)',
                        height: '44px',
                        fontFamily: 'monospace',
                        fontWeight: 500
                      }}
                      placeholder="Enter database name"
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '28px', marginBottom: 0 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleValidateMysqlConnection}
                      disabled={isMysqlValidating || (mysqlConnectionState === 'connected' && Boolean(mysqlConfig.database))}
                      style={{
                        width: '100%',
                        minWidth: '180px',
                        height: '44px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: (mysqlConnectionState === 'connected' && Boolean(mysqlConfig.database)) ? 'var(--success)' : '',
                        borderColor: (mysqlConnectionState === 'connected' && Boolean(mysqlConfig.database)) ? 'var(--success)' : ''
                      }}
                    >
                      {isMysqlValidating && <Loader2 size={16} className="spin" />}
                      {!isMysqlValidating && (mysqlConnectionState === 'connected' && Boolean(mysqlConfig.database)) && <CheckCircle size={16} />}
                      {isMysqlValidating ? 'Validating...' : ((mysqlConnectionState === 'connected' && Boolean(mysqlConfig.database)) ? 'Database Validated' : 'Validate Database ↗')}
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
