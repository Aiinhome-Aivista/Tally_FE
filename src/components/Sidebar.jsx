import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Database, Activity, LayoutDashboard, Plug, History } from 'lucide-react';

const Sidebar = () => {
  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
      <Link to="/" className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
        <Database size={24} color="var(--accent-color)" />
        <span>TallySync</span>
      </Link>
      
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

        <NavLink 
          to="/connector" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Plug size={20} />
          <span>Connector</span>
        </NavLink>

        {/* <NavLink 
          to="/connector-history" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <History size={20} />
          <span>Connector History</span>
        </NavLink> */}
      </nav>
      </div>


    </div>
  );
};

export default Sidebar;
