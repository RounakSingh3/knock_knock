import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Film, Rocket, User } from 'lucide-react';

const BottomNav = () => {
    return (
        <nav className="bottom-nav">
            <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Home">
                <Home size={22} strokeWidth={2.2} />
                <span className="nav-label">Home</span>
            </NavLink>
            <NavLink to="/explore" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Explore">
                <Search size={22} strokeWidth={2.2} />
                <span className="nav-label">Explore</span>
            </NavLink>
            <NavLink to="/reels" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Reels">
                <Film size={22} strokeWidth={2.2} />
                <span className="nav-label">Reels</span>
            </NavLink>
            <NavLink to="/boost" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Boost">
                <Rocket size={22} strokeWidth={2.2} />
                <span className="nav-label">Boost</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Profile">
                <User size={22} strokeWidth={2.2} />
                <span className="nav-label">Profile</span>
            </NavLink>
        </nav>
    );
};

export default BottomNav;
