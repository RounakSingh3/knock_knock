import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Phone, Settings, Rocket, Lock } from 'lucide-react';
import { isCallingAllowedNow } from '../lib/callingWindow';

const BottomNav = React.memo(() => {
    const [callOpen, setCallOpen] = useState(isCallingAllowedNow());

    useEffect(() => {
        const interval = setInterval(() => {
            setCallOpen(isCallingAllowedNow());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <nav className="bottom-nav">
            <NavLink to="/call" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
                <Phone size={24} style={{ opacity: callOpen ? 1 : 0.6 }} />
                {!callOpen && (
                    <span style={{
                        position: 'absolute',
                        top: '6px',
                        right: '18px',
                        background: '#ff453a',
                        borderRadius: '50%',
                        width: '8px',
                        height: '8px',
                        boxShadow: '0 0 5px #ff453a'
                    }} />
                )}
            </NavLink>
            <NavLink to="/boost" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Rocket size={24} />
            </NavLink>
            <NavLink to="/explore" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Search size={24} />
            </NavLink>
            <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Home size={24} />
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Settings size={24} />
            </NavLink>
        </nav>
    );
});

export default BottomNav;
