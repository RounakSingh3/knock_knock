import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Film, Users, Phone, Settings } from 'lucide-react';

const BottomNav = () => {
    return (
        <nav className="bottom-nav">
            <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Home size={26} />
            </NavLink>
            <NavLink to="/reels" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Film size={26} />
            </NavLink>
            <NavLink to="/connections" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Users size={26} />
            </NavLink>
            <NavLink to="/call" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Phone size={26} />
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Settings size={26} />
            </NavLink>
        </nav>
    );
};

export default BottomNav;

