import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, DatabaseBackup, ChevronLeft, ChevronRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const LogHistory = () => {
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const limit = 10;

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const skip = (page - 1) * limit;
      const res = await axios.get(`${API_URL}/logs?skip=${skip}&limit=${limit}`);
      setLogs(res.data.logs);
      setTotalLogs(res.data.total);
    } catch (err) {
      console.error("Failed to fetch logs", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    
    // Auto refresh every 30 seconds
    const intervalId = setInterval(fetchLogs, 30000);
    return () => clearInterval(intervalId);
  }, [page]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(date);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Sync Log History</h1>
        <button 
          className="btn" 
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)' }}
          onClick={fetchLogs}
          disabled={isLoading}
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} style={isLoading ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {logs.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <DatabaseBackup size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <p>No synchronization logs found yet.</p>
            <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Logs will appear here when the background scheduler executes.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Status</th>
                  <th>Records Fetched</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.timestamp)}</td>
                    <td>
                      <span className={`status status-${log.status.toLowerCase()}`}>
                        {log.status}
                      </span>
                    </td>
                    <td>{log.records_fetched}</td>
                    <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.message}>
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Showing {totalLogs === 0 ? 0 : Math.min((page - 1) * limit + 1, totalLogs)} to {Math.min(page * limit, totalLogs)} of {totalLogs} entries
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn" 
                  style={{ padding: '8px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                >
                  <ChevronLeft size={16} />
                  Prev
                </button>
                <button 
                  className="btn" 
                  style={{ padding: '8px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
                  onClick={() => setPage(p => Math.min(Math.ceil(totalLogs / limit), p + 1))}
                  disabled={page >= Math.ceil(totalLogs / limit) || totalLogs === 0 || isLoading}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
};

export default LogHistory;
