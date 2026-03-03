import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, PlaySquare, Compass, Phone } from 'lucide-react';

const BottomNav = () => {
    return (
        <nav className="bottom-nav">
            <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Home size={28} />
            </NavLink>
            <NavLink to="/stories" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <PlaySquare size={28} />
            </NavLink>
            <NavLink to="/explore" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Compass size={28} />
            </NavLink>
            <NavLink to="/call" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Phone size={28} />
            </NavLink>
        </nav>
    );
};

export default BottomNav;
