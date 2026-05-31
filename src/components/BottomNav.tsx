import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Film, Compass, Phone, User, Zap } from 'lucide-react';

const BottomNav = () => {
    return (
        <nav className="bottom-nav">
            <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Home size={26} />
            </NavLink>
            <NavLink to="/reels" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Film size={26} />
            </NavLink>
            <NavLink to="/stories" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Zap size={26} />
            </NavLink>
            <NavLink to="/explore" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Compass size={26} />
            </NavLink>
            <NavLink to="/call" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Phone size={26} />
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <User size={26} />
            </NavLink>
        </nav>
    );
};

export default BottomNav;
