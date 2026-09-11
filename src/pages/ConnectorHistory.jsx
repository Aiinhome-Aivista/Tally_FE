import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, Play, Database, RefreshCw, XCircle, CheckCircle, Trash2, Edit2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const CustomSpinner = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3" fill={color} />
    <g className="spin" style={{ transformOrigin: 'center' }}>
      <circle cx="12" cy="3" r="3" fill={color} />
      <circle cx="19.79" cy="7.5" r="3" fill={color} />
      <circle cx="19.79" cy="16.5" r="3" fill={color} />
      <circle cx="12" cy="21" r="3" fill={color} />
      <circle cx="4.21" cy="16.5" r="3" fill={color} />
      <circle cx="4.21" cy="7.5" r="3" fill={color} />
    </g>
  </svg>
);

const ConnectorHistory = ({ isEmbedded = false, onConfigUpdated, onRunManualSync, onEditConnection, refreshTrigger }) => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState(null);

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedConnectionName, setSelectedConnectionName] = useState(null);
  const [connectionLogs, setConnectionLogs] = useState([]);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editConfigName, setEditConfigName] = useState('');
  const [editRequestXml, setEditRequestXml] = useState('');
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  const fetchConfigs = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/config`);
      
      if (res.data && Array.isArray(res.data)) {
        const configuredList = await Promise.all(res.data.map(async (cfg, idx) => {
          let lastSync = 'Never';
          let syncStatus = 'N/A';
          let rowsProcessed = 0;
          
          try {
            const logsRes = await axios.get(`${API_URL}/logs?connection_name=${cfg.connection_name}&limit=1`);
            if (logsRes.data && logsRes.data.logs && logsRes.data.logs.length > 0) {
              const latestLog = logsRes.data.logs[0];
              const date = new Date(latestLog.timestamp);
              lastSync = new Intl.DateTimeFormat('en-US', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
              }).format(date);
              syncStatus = latestLog.status;
              rowsProcessed = latestLog.records_fetched || 0;
            }
          } catch (e) {
            console.error("Failed to fetch logs for", cfg.connection_name, e);
          }
          
          return {
            id: idx + 1,
            last_sync: lastSync,
            sync_status: syncStatus,
            rows_processed: rowsProcessed,
            ...cfg
          };
        }));
        setConfigs(configuredList);
      } else {
        setConfigs([]);
      }
    } catch (err) {
      console.error("Failed to fetch configs", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, [refreshTrigger]);

  const showToast = (type, msg) => {
    setStatus({ type, msg });
    setTimeout(() => {
      setStatus(null);
    }, 3000);
  };

  const fetchConnectionLogs = async (connection_name) => {
    setIsLogsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/logs?connection_name=${connection_name}&limit=50`);
      setConnectionLogs(res.data.logs || []);
    } catch (e) {
      console.error("Failed to fetch logs", e);
    } finally {
      setIsLogsLoading(false);
    }
  };

  const handleViewLogs = (connection_name) => {
    setSelectedConnectionName(connection_name);
    setIsLogModalOpen(true);
    setConnectionLogs([]);
    fetchConnectionLogs(connection_name);
  };

  const handleRun = async (config) => {
    if (onRunManualSync) {
      onRunManualSync(config.connection_name);
      return;
    }

    setIsRunning(true);
    showToast('success', 'Sync Started...');
    try {
      const res = await axios.post(`${API_URL}/sync/test`, {
        connection_name: config.connection_name,
        tally_host: config.tally_host,
        tally_port: config.tally_port,
        request_xml: config.request_xml
      });
      showToast('success', 'Sync Completed!');
    } catch (err) {
      showToast('error', 'Sync Failed!');
    } finally {
      setIsRunning(false);
    }
  };

  const handleDeleteClick = (connection_name) => {
    setConnectionToDelete(connection_name);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!connectionToDelete) return;
    setDeleteModalOpen(false);
    setIsLoading(true);
    try {
      await axios.delete(`${API_URL}/config/${encodeURIComponent(connectionToDelete)}`);
      showToast('success', 'Connection Deleted');
      setConnectionToDelete(null);
      fetchConfigs();
      if (onConfigUpdated) onConfigUpdated();
    } catch (err) {
      showToast('error', 'Delete Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (config) => {
    if (onEditConnection) {
      onEditConnection(config);
      return;
    }
    setEditConfigName(config.connection_name);
    setEditRequestXml(config.request_xml || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateConfig = async () => {
    if (!editConfigName) return;
    setIsUpdatingConfig(true);
    try {
      const configObj = configs.find(c => c.connection_name === editConfigName);
      if (!configObj) return;

      await axios.put(`${API_URL}/config/${editConfigName}`, {
        connection_name: editConfigName,
        tally_host: configObj.tally_host,
        tally_port: configObj.tally_port,
        company_name: configObj.company_name,
        report_name: configObj.report_name,
        file_format: configObj.file_format,
        request_xml: editRequestXml
      });
      setIsEditModalOpen(false);

      if (onConfigUpdated) {
        onConfigUpdated(editConfigName);
      } else {
        navigate('/connector', { state: { testConnection: editConfigName } });
      }
    } catch (err) {
      showToast('error', 'Update Failed!');
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  // --- BEGIN SYNC ALL STATE & FUNCTION ---
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    if (configs.length === 0) {
      showToast('error', 'No connections to sync.');
      return;
    }
    
    setIsSyncingAll(true);
    showToast('success', 'Starting Sync All...');
    
    // Start background sync for all configurations
    for (const config of configs) {
      try {
        await axios.post(`${API_URL}/sync/start`, {
          connection_name: config.connection_name,
          tally_host: config.tally_host,
          tally_port: config.tally_port,
          request_xml: config.request_xml
        });
      } catch (err) {
        console.error(`Failed to start sync for ${config.connection_name}`, err);
      }
      // Small 300ms delay to prevent overwhelming the server
      await new Promise(r => setTimeout(r, 300));
    }
    
    showToast('success', 'All syncs initiated!');
    setIsSyncingAll(false);
    
    // Refresh table immediately so rows show "In Progress"
    fetchConfigs(true);
  };
  // --- END SYNC ALL STATE & FUNCTION ---

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        {!isEmbedded && <h1 className="page-title" style={{ margin: 0 }}>Connector History</h1>}
        {isEmbedded && <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Configured Connections</h2>}
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* --- BEGIN SYNC ALL BUTTON --- */}
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={handleSyncAll}
            disabled={isSyncingAll || isLoading || configs.length === 0}
            title="Sync all active connections sequentially"
          >
            {isSyncingAll ? <Loader2 size={18} className="spin" /> : <Play size={18} />}
            Sync All
          </button>
          {/* --- END SYNC ALL BUTTON --- */}

          <button
            className="btn"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => fetchConfigs()}
            disabled={isLoading}
          >
            <RefreshCw size={18} className={isLoading ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Connection Name</th>
                <th>Host</th>
                <th>Port</th>
                <th>Company Name</th>
                <th>Report Name</th>
                <th>Database Name</th>
                <th>Status</th>
                <th>Rows Processed</th>
                <th>Scheduler</th>
                <th>Last Sync</th>
                <th>View</th>
                <th>Edit</th>
                <th>Run</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {configs.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    <Database size={48} style={{ opacity: 0.5, marginBottom: '16px', display: 'inline-block' }} />
                    <p style={{ margin: 0 }}>No active connections found.</p>
                  </td>
                </tr>
              ) : (
                configs.map((config) => (
                  <tr key={config.id}>
                    <td style={{ fontWeight: 500, color: 'var(--accent-color)' }}>{config.connection_name}</td>
                    <td>{config.tally_host}</td>
                    <td>{config.tally_port}</td>
                    <td>{config.company_name || 'N/A'}</td>
                    <td>{config.report_name || 'N/A'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent-color)' }}>
                      {config.database_name || 'N/A'}
                    </td>
                    <td>
                      {isLoading ? (
                        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                          <CustomSpinner size={18} color="var(--text-secondary)" />
                        </span>
                      ) : config.sync_status === 'IN_PROGRESS' ? (
                        <span style={{ color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          In Progress...
                        </span>
                      ) : config.sync_status === 'SUCCESS' ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>Success</span>
                      ) : config.sync_status === 'ERROR' ? (
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Failed</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>{config.sync_status}</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {isLoading ? (
                         <CustomSpinner size={18} color="var(--text-secondary)" />
                      ) : (
                         config.rows_processed.toLocaleString()
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontWeight: 600, fontSize: '0.8rem', padding: '4px 10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <span className="blink-dot" style={{ backgroundColor: 'var(--success)' }}></span> Active
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{config.last_sync}</td>
                    <td>
                      <button
                        className="btn"
                        style={{ padding: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                        title="View Details"
                        onClick={() => handleViewLogs(config.connection_name)}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn"
                        style={{ padding: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)' }}
                        title="Edit Configuration"
                        onClick={() => handleEditClick(config)}
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn"
                        style={{ padding: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}
                        title="Run Sync Now"
                        onClick={() => handleRun(config)}
                        disabled={isRunning}
                      >
                        <Play size={16} />
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn"
                        style={{ padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}
                        title="Delete & Stop"
                        onClick={() => handleDeleteClick(config.connection_name)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {status && (
        <div className={`toast`} style={{
          backgroundColor: 'var(--bg-panel)',
          color: status.type === 'success' ? 'var(--success)' : 'var(--danger)',
          borderLeft: `4px solid ${status.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
        }}>
          {status.type === 'success' ? <CheckCircle size={24} /> : <XCircle size={24} />}
          <span style={{ fontWeight: 500 }}>{status.msg}</span>
        </div>
      )}

      {/* Sliding Panel for Logs */}
      <div className={`sliding-panel-overlay ${isLogModalOpen ? 'open' : ''}`} onClick={() => setIsLogModalOpen(false)}></div>
      <div className={`sliding-panel ${isLogModalOpen ? 'open' : ''}`}>
        <div className="sliding-panel-header">
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Logs: <span style={{ color: 'var(--accent-color)' }}>{selectedConnectionName}</span></h2>
          <button className="btn" style={{ padding: '8px', color: 'var(--text-secondary)', background: 'transparent' }} onClick={() => setIsLogModalOpen(false)}>
            <XCircle size={24} />
          </button>
        </div>
        <div className="sliding-panel-body">
          {isLogsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{
                  position: 'absolute',
                  width: '100%', height: '100%',
                  border: '4px solid rgba(59, 130, 246, 0.2)',
                  borderTopColor: 'var(--accent-color)',
                  borderBottomColor: 'var(--accent-color)',
                  borderRadius: '50%',
                  animation: 'spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite'
                }}></div>
                <div style={{
                  position: 'absolute',
                  width: '70%', height: '70%',
                  border: '3px solid rgba(59, 130, 246, 0.1)',
                  borderLeftColor: 'var(--accent-color)',
                  borderRightColor: 'var(--accent-color)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite reverse'
                }}></div>
                <Database size={24} color="var(--accent-color)" />
              </div>
            </div>
          ) : connectionLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <Database size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>No logs found for this connection.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {connectionLogs.map((log) => {
                const isSuccess = log.status === 'SUCCESS';
                return (
                  <div key={log.id} style={{
                    backgroundColor: 'var(--bg-panel)',
                    borderRadius: '12px',
                    border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px',
                      backgroundColor: isSuccess ? 'var(--success)' : 'var(--danger)'
                    }}></div>

                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isSuccess ? <CheckCircle size={18} color="var(--success)" /> : <XCircle size={18} color="var(--danger)" />}
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isSuccess ? 'var(--success)' : 'var(--danger)', letterSpacing: '0.5px' }}>
                            {log.status}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(log.timestamp))}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                        {log.message}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          color: 'var(--accent-color)',
                          fontWeight: 500
                        }}>
                          Records Fetched: {log.records_fetched}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '50%' }}>
                <Trash2 size={48} color="var(--danger)" />
              </div>
            </div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Delete Connection?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Are you sure you want to delete the connection <strong>"{connectionToDelete}"</strong>? This will permanently stop the sync for this configuration.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                className="btn"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '10px 24px', flex: 1 }}
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{ backgroundColor: 'var(--danger)', color: 'white', padding: '10px 24px', flex: 1 }}
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit XML Modal */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '90%', maxWidth: '800px', maxHeight: '90vh', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>Edit XML Payload: {editConfigName}</h2>
              <button className="btn" style={{ background: 'transparent', padding: '8px', color: 'var(--text-secondary)' }} onClick={() => setIsEditModalOpen(false)}>
                <XCircle size={24} />
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '350px', position: 'relative' }}>
              <textarea
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-panel)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '16px',
                  fontFamily: 'monospace',
                  color: 'var(--text-primary)',
                  resize: 'none',
                  minHeight: '300px'
                }}
                value={editRequestXml}
                onChange={e => setEditRequestXml(e.target.value)}
              />
              {isUpdatingConfig && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: '6px',
                  zIndex: 10
                }}>
                  <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{
                      position: 'absolute',
                      width: '100%', height: '100%',
                      border: '4px solid rgba(59, 130, 246, 0.2)',
                      borderTopColor: 'var(--accent-color)',
                      borderBottomColor: 'var(--accent-color)',
                      borderRadius: '50%',
                      animation: 'spin 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite'
                    }}></div>
                    <div style={{
                      position: 'absolute',
                      width: '70%', height: '70%',
                      border: '3px solid rgba(59, 130, 246, 0.1)',
                      borderLeftColor: 'var(--accent-color)',
                      borderRightColor: 'var(--accent-color)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite reverse'
                    }}></div>
                    <Database size={24} color="var(--accent-color)" />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px' }}>
              <button
                className="btn"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '10px 24px' }}
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ backgroundColor: 'var(--warning)', borderColor: 'var(--warning)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={handleUpdateConfig}
                disabled={isUpdatingConfig}
              >
                {isUpdatingConfig ? <RefreshCw size={16} className="spin" /> : <Edit2 size={16} />}
                Update Configuration
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ConnectorHistory;
