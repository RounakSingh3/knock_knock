import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { uploadMedia, createNewPost, updatePoints } from '../lib/database';
import { getMediaTypeFromFile, compressImage } from '../lib/media';
import { CONTENT_CATEGORIES } from '../lib/algorithm';
import { ImagePlus, Loader2, Link as LinkIcon, Trash2 } from 'lucide-react';

const CSS_FILTERS = [
    { name: 'Normal', filter: 'none' },
    { name: 'Clarendon', filter: 'contrast(1.2) saturate(1.35)' },
    { name: 'Gingham', filter: 'brightness(1.05) hue-rotate(-10deg)' },
    { name: 'Moon', filter: 'grayscale(1) contrast(1.1) brightness(1.1)' },
    { name: 'Lark', filter: 'contrast(0.9)' },
    { name: 'Reyes', filter: 'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)' },
    { name: 'Juno', filter: 'saturate(1.4) hue-rotate(-10deg) contrast(1.1)' },
    { name: 'Slumber', filter: 'saturate(0.66) brightness(1.05)' },
    { name: 'Crema', filter: 'sepia(0.5) contrast(1.25) brightness(1.15) saturate(0.9) hue-rotate(-2deg)' },
    { name: 'Ludwig', filter: 'sepia(0.25) contrast(1.05) brightness(1.05) saturate(2)' },
    { name: 'Aden', filter: 'hue-rotate(-20deg) contrast(0.9) saturate(0.85) brightness(1.2)' },
    { name: 'Perpetua', filter: 'contrast(1.1) brightness(1.25) saturate(1.1)' }
];

const CreatePost = () => {
    const { user, points, setPoints } = useContext(AppContext);
    const navigate = useNavigate();

    const queryParams = new URLSearchParams(window.location.search);
    const isFromSpotlight = queryParams.get('redirect') === 'boost';

    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFilter, setSelectedFilter] = useState('none');
    const [caption, setCaption] = useState('');
    const [attachedLink, setAttachedLink] = useState('');
    const [category, setCategory] = useState('General');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [boostToSpotlight, setBoostToSpotlight] = useState(isFromSpotlight && points >= 10);
    const [boostAmount, setBoostAmount] = useState(points >= 100 ? 100 : Math.max(10, points));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setSelectedFilter('none');
    };

    const handleUpload = async () => {
        if (!file || !user) {
            setError('Please select a media file first.');
            return;
        }

        setLoading(true);
        setError('');
        setUploadProgress(null);

        try {
            const mediaType = getMediaTypeFromFile(file);
            let fileToUpload = file;

            if (mediaType === 'image') {
                try {
                    setError('Compressing image for fast upload...');
                    fileToUpload = await compressImage(file, 1200, 1200, 0.8);
                    setError('');
                } catch (compErr) {
                    console.error('Image compression failed, using original file:', compErr);
                }
            } else if (mediaType === 'video') {
                const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
                if (file.size > MAX_VIDEO_SIZE) {
                    setError(`This video is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please select a video smaller than 50MB.`);
                    setLoading(false);
                    return;
                }
            }

            setUploadProgress(0);
            const fileExt = fileToUpload.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const path = `posts/${fileName}`;

            const publicUrl = await uploadMedia(fileToUpload, path, (progress) => {
                const total = progress.total || fileToUpload.size || 1;
                const percentage = Math.round((progress.loaded / total) * 100);
                setUploadProgress(percentage);
            });

            let finalUrl = publicUrl;
            if (selectedFilter !== 'none') {
                try {
                    const u = new URL(publicUrl);
                    u.searchParams.set('filter', selectedFilter);
                    finalUrl = u.toString();
                } catch (e) {
                    finalUrl = publicUrl.includes('?') 
                        ? `${publicUrl}&filter=${encodeURIComponent(selectedFilter)}`
                        : `${publicUrl}?filter=${encodeURIComponent(selectedFilter)}`;
                }
            }

            // Expiry is 24 hours from now
            const boostExpiresAt = boostToSpotlight 
                ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                : null;

            await createNewPost({
                user_id: user.id,
                username: user.username || 'user',
                avatar_url: user.avatar_url || 'https://i.pravatar.cc/150',
                image_url: finalUrl,
                caption,
                attached_link: attachedLink || undefined,
                media_type: mediaType,
                category,
                css_filter: selectedFilter,
                boost_expires_at: boostExpiresAt,
                boost_impressions_remaining: boostToSpotlight ? boostAmount : 0
            });

            if (boostToSpotlight) {
                const newPoints = points - boostAmount;
                await updatePoints(user.id, newPoints);
                setPoints(newPoints);
            }

            const redirect = queryParams.get('redirect');
            if (redirect === 'boost') {
                navigate(boostToSpotlight ? '/boost?mode=feed' : '/boost?mode=select');
            } else if (redirect) {
                navigate(`/${redirect}`);
            } else {
                navigate('/home');
            }
        } catch (err: unknown) {
            console.error('Upload Error:', err);
            const message = err instanceof Error ? err.message : 'An error occurred during upload.';
            setError(message);
        } finally {
            setLoading(false);
            setUploadProgress(null);
        }
    };

    return (
        <div style={{ padding: '16px', background: 'var(--bg-color)', minHeight: '100vh', color: 'var(--text-active)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>New Post</h1>
                <button 
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-inactive)', fontSize: '16px' }}
                >
                    Cancel
                </button>
            </div>

            {error && <div style={{ color: '#ff3366', marginBottom: '16px', padding: '12px', background: 'rgba(255,51,102,0.1)', borderRadius: '8px' }}>{error}</div>}

            {!previewUrl ? (
                <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: '2px dashed #2c2c2e', borderRadius: '16px', height: '300px', cursor: 'pointer',
                    background: 'var(--surface-color)', marginBottom: '24px'
                }}>
                    <ImagePlus size={48} color="#8e8e93" style={{ marginBottom: '16px' }} />
                    <span style={{ color: 'var(--text-inactive)' }}>Tap to select photo or video</span>
                    <input 
                        type="file" 
                        accept="image/*,video/*" 
                        multiple={false} 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                    />
                </label>
            ) : (
                <div style={{ position: 'relative', marginBottom: '16px', borderRadius: '16px', overflow: 'hidden', background: 'var(--surface-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                    {file?.type.startsWith('video/') ? (
                        <video src={previewUrl} style={{ maxWidth: '100%', maxHeight: '100%', filter: selectedFilter }} controls autoPlay playsInline loop />
                    ) : (
                        <img src={previewUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: selectedFilter }} alt="Preview" />
                    )}
                    <button 
                        onClick={handleRemoveFile}
                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', display: 'flex' }}
                    >
                        <Trash2 size={20} color="#ff3b30" />
                    </button>
                </div>
            )}

            {previewUrl && (
                <div style={{ marginBottom: '24px', overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '8px', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ display: 'inline-flex', gap: '12px' }}>
                        {CSS_FILTERS.map(f => (
                            <button
                                key={f.name}
                                onClick={() => setSelectedFilter(f.filter)}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                    opacity: selectedFilter === f.filter ? 1 : 0.6,
                                    transform: selectedFilter === f.filter ? 'scale(1.05)' : 'scale(1)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ 
                                    width: '60px', height: '60px', borderRadius: '12px', 
                                    background: 'var(--border-color)', marginBottom: '8px', overflow: 'hidden',
                                    border: selectedFilter === f.filter ? '2px solid #ff3366' : '2px solid transparent'
                                }}>
                                    {file?.type.startsWith('video/') ? (
                                        <video src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: f.filter }} muted />
                                    ) : (
                                        <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: f.filter }} alt="" />
                                    )}
                                </div>
                                <span style={{ color: 'var(--text-active)', fontSize: '11px', fontWeight: selectedFilter === f.filter ? 'bold' : 'normal' }}>
                                    {f.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '16px' }}>
                <textarea 
                    placeholder="Write a caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    style={{
                        width: '100%',
                        background: 'var(--surface-color)',
                        border: '1px solid #2c2c2e',
                        borderRadius: '12px',
                        padding: '16px',
                        color: 'var(--text-active)',
                        minHeight: '100px',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                    }}
                />
            </div>

            <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-color)', border: '1px solid #2c2c2e', borderRadius: '12px', padding: '12px 16px' }}>
                    <LinkIcon size={20} color="#8e8e93" style={{ marginRight: '12px' }} />
                    <input 
                        type="url"
                        placeholder="Attach Link (Optional)"
                        value={attachedLink}
                        onChange={(e) => setAttachedLink(e.target.value)}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-active)',
                            outline: 'none',
                            fontSize: '15px'
                        }}
                    />
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-inactive)', marginTop: '8px', paddingLeft: '4px' }}>
                    Users can swipe left on your post to open this link.
                </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', color: 'var(--text-inactive)', marginBottom: '8px', display: 'block' }}>Category</label>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                        width: '100%',
                        background: 'var(--surface-color)',
                        border: '1px solid #2c2c2e',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        color: 'var(--text-active)',
                        fontSize: '15px',
                        outline: 'none',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%238e8e93' viewBox='0 0 16 16'%3E%3Cpath d='M8 12L2 6h12z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 16px center',
                    }}
                >
                    {CONTENT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat} style={{ background: 'var(--surface-color)' }}>{cat}</option>
                    ))}
                </select>
            </div>

            <div style={{ 
                marginBottom: '24px', 
                padding: '16px', 
                background: 'rgba(255, 51, 102, 0.05)', 
                border: '1px solid rgba(255, 51, 102, 0.2)', 
                borderRadius: '16px' 
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🚀</span>
                        <div>
                            <span style={{ color: 'var(--text-active)', fontWeight: 'bold', display: 'block' }}>Boost to Spotlight</span>
                            <span style={{ color: 'var(--text-inactive)', fontSize: '12px' }}>Feature on Spotlight for 24h</span>
                        </div>
                    </div>
                    {points > 0 ? (
                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                            <input 
                                type="checkbox" 
                                checked={boostToSpotlight} 
                                onChange={(e) => setBoostToSpotlight(e.target.checked)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                            />
                            <span style={{ 
                                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                                backgroundColor: boostToSpotlight ? '#ff3366' : '#555', 
                                transition: '.4s', borderRadius: '24px' 
                            }}>
                                <span style={{ 
                                    position: 'absolute', content: '""', height: '18px', width: '18px', 
                                    left: boostToSpotlight ? '22px' : '4px', bottom: '3px', 
                                    backgroundColor: 'white', transition: '.4s', borderRadius: '50%' 
                                }} />
                            </span>
                        </label>
                    ) : (
                        <span style={{ color: '#ff3366', fontSize: '12px', fontWeight: 'bold' }}>Need points</span>
                    )}
                </div>
                {boostToSpotlight && points > 0 && (
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-active)' }}>Points to spend: <strong style={{ color: '#ffcc00' }}>{boostAmount}</strong></span>
                            <span style={{ fontSize: '13px', color: 'var(--text-inactive)' }}>Guarantees {boostAmount} views</span>
                        </div>
                        <input 
                            type="range" 
                            min="1" 
                            max={Math.max(1, points)} 
                            value={boostAmount} 
                            onChange={(e) => setBoostAmount(parseInt(e.target.value))}
                            style={{ width: '100%', accentColor: '#ff3366' }}
                        />
                    </div>
                )}
                {points === 0 && (
                    <p style={{ color: 'var(--text-inactive)', fontSize: '11px', marginTop: '8px', marginBottom: 0 }}>
                        You currently have {points} points. Stay active or make posts to earn more points!
                    </p>
                )}
            </div>

            {loading ? (
                <div style={{
                    width: '100%',
                    background: 'var(--surface-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '30px',
                    padding: '16px',
                    boxSizing: 'border-box',
                    marginBottom: '16px'
                }}>
                    {uploadProgress !== null ? (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--text-active)', fontWeight: 'bold' }}>
                                <span>Uploading {file ? getMediaTypeFromFile(file) : 'file'}...</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'linear-gradient(90deg, #ff3366, #ff9933)', transition: 'width 0.1s ease-out' }} />
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-active)' }}>
                            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                            <span>Processing media...</span>
                        </div>
                    )}
                </div>
            ) : (
                <button 
                    onClick={handleUpload}
                    disabled={!file}
                    style={{
                        width: '100%',
                        background: !file ? 'var(--border-color)' : 'linear-gradient(45deg, #ff3366, #ff9933)',
                        color: !file ? 'var(--text-inactive)' : 'var(--text-active)',
                        border: 'none',
                        borderRadius: '30px',
                        padding: '16px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: !file ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s',
                        marginBottom: '16px'
                    }}
                >
                    Share Post
                </button>
            )}
        </div>
    );
};

export default CreatePost;
