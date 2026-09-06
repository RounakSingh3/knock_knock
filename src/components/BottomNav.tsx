import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Film, Phone, Settings, Rocket } from 'lucide-react';

const BottomNav = () => {
    return (
        <nav className="bottom-nav">
            <NavLink to="/call" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Phone size={24} />
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
};

export default BottomNav;
