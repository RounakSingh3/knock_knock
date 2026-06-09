import React, { useState, useContext } from 'react';
import { X, Loader2, Camera } from 'lucide-react';
import { updateProfile, uploadMedia } from '../lib/database';
import { AppContext } from '../App';

interface EditProfileSheetProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: { id: string; username: string; avatar_url?: string; bio?: string };
    onUpdated: () => void;
}

const EditProfileSheet: React.FC<EditProfileSheetProps> = ({ isOpen, onClose, currentUser, onUpdated }) => {
    const { setUser } = useContext(AppContext);
    const [username, setUsername] = useState(currentUser.username || '');
    const [bio, setBio] = useState(currentUser.bio || '');
    const [avatarPreview, setAvatarPreview] = useState(currentUser.avatar_url || '');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');

        try {
            const updates: { username?: string; bio?: string; avatar_url?: string } = {};

            if (username.trim() && username !== currentUser.username) {
                updates.username = username.trim();
            }
            if (bio !== (currentUser.bio || '')) {
                updates.bio = bio;
            }
            if (avatarFile) {
                const ext = avatarFile.name.split('.').pop();
                const path = `avatars/${currentUser.id}-${Date.now()}.${ext}`;
                const publicUrl = await uploadMedia(avatarFile, path);
                updates.avatar_url = publicUrl;
            }

            if (Object.keys(updates).length > 0) {
                const success = await updateProfile(currentUser.id, updates);
                if (!success) {
                    setError('Failed to save. Please try again.');
                    setSaving(false);
                    return;
                }

                // Update global state & localStorage so the changes sync everywhere instantly
                setUser(prev => {
                    if (!prev) return null;
                    const newProfile = { ...prev, ...updates };
                    localStorage.setItem('knock_user_session', JSON.stringify(newProfile));
                    return newProfile;
                });
            }

            setSaving(false);
            onUpdated();
            onClose();
        } catch (err) {
            console.error('Error saving profile:', err);
            setError('Something went wrong.');
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.7)', zIndex: 2100,
            display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        }} onClick={onClose}>
            <div style={{
                background: 'var(--surface-color)', width: '100%', maxWidth: '500px',
                borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                padding: '24px', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }} onClick={e => e.stopPropagation()}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-active)', fontSize: '18px', fontWeight: 'bold' }}>Edit Profile</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', cursor: 'pointer' }}>
                        <X size={22} />
                    </button>
                </div>

                {error && (
                    <div style={{ color: '#ff3366', fontSize: '13px', marginBottom: '16px', padding: '8px 12px', background: 'rgba(255,51,102,0.1)', borderRadius: '8px' }}>
                        {error}
                    </div>
                )}

                {/* Avatar */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    <label style={{ position: 'relative', cursor: 'pointer' }}>
                        <img
                            src={avatarPreview || 'https://i.pravatar.cc/150'}
                            alt="Avatar"
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #ff3366' }}
                        />
                        <div style={{
                            position: 'absolute', bottom: 0, right: 0,
                            background: '#ff3366', borderRadius: '50%',
                            width: '28px', height: '28px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Camera size={14} color="var(--text-active)" />
                        </div>
                        <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                    </label>
                </div>

                {/* Username */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-inactive)', display: 'block', marginBottom: '6px' }}>Username</label>
                    <input
                        type="text" value={username}
                        onChange={e => setUsername(e.target.value)}
                        style={{
                            width: '100%', background: 'var(--border-color)', border: 'none',
                            borderRadius: '12px', padding: '12px 16px', color: 'var(--text-active)',
                            fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                        }}
                    />
                </div>

                {/* Bio */}
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-inactive)', display: 'block', marginBottom: '6px' }}>
                        Bio <span style={{ float: 'right' }}>{bio.length}/150</span>
                    </label>
                    <textarea
                        value={bio}
                        onChange={e => { if (e.target.value.length <= 150) setBio(e.target.value); }}
                        placeholder="Tell people about yourself..."
                        style={{
                            width: '100%', background: 'var(--border-color)', border: 'none',
                            borderRadius: '12px', padding: '12px 16px', color: 'var(--text-active)',
                            fontSize: '15px', outline: 'none', resize: 'none',
                            minHeight: '80px', fontFamily: 'inherit', boxSizing: 'border-box',
                        }}
                    />
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        width: '100%', background: saving ? 'var(--border-color)' : 'linear-gradient(45deg, #ff3366, #ff9933)',
                        border: 'none', borderRadius: '24px', padding: '14px',
                        color: 'var(--text-active)', fontWeight: 'bold', fontSize: '16px',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    {saving ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : 'Save Changes'}
                </button>
            </div>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default EditProfileSheet;
