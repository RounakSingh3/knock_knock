import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { uploadMedia, createNewPost } from '../lib/database';
import { getMediaTypeFromFile } from '../lib/media';
import { ImagePlus, Loader2, Link as LinkIcon, Trash2 } from 'lucide-react';

const CreatePost = () => {
    const { user } = useContext(AppContext);
    const navigate = useNavigate();

    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [attachedLink, setAttachedLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
    };

    const handleUpload = async () => {
        if (!file || !user) {
            setError('Please select a media file first.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const path = `posts/${fileName}`;

            const publicUrl = await uploadMedia(file, path);

            await createNewPost({
                user_id: user.id,
                username: user.username || 'user',
                avatar_url: user.avatar_url || 'https://i.pravatar.cc/150',
                image_url: publicUrl,
                caption,
                attached_link: attachedLink || undefined,
                media_type: getMediaTypeFromFile(file),
            });

            navigate('/home');
        } catch (err: unknown) {
            console.error('Upload Error:', err);
            const message = err instanceof Error ? err.message : 'An error occurred during upload.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '16px', background: '#000', minHeight: '100vh', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>New Post</h1>
                <button 
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', color: '#8e8e93', fontSize: '16px' }}
                >
                    Cancel
                </button>
            </div>

            {error && <div style={{ color: '#ff3366', marginBottom: '16px', padding: '12px', background: 'rgba(255,51,102,0.1)', borderRadius: '8px' }}>{error}</div>}

            {!previewUrl ? (
                <label style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: '2px dashed #2c2c2e', borderRadius: '16px', height: '300px', cursor: 'pointer',
                    background: '#121212', marginBottom: '24px'
                }}>
                    <ImagePlus size={48} color="#8e8e93" style={{ marginBottom: '16px' }} />
                    <span style={{ color: '#8e8e93' }}>Tap to select photo or video</span>
                    <input 
                        type="file" 
                        accept="image/*,video/*" 
                        multiple={false} 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                    />
                </label>
            ) : (
                <div style={{ position: 'relative', marginBottom: '24px', borderRadius: '16px', overflow: 'hidden', background: '#121212', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                    {file?.type.startsWith('video/') ? (
                        <video src={previewUrl} style={{ maxWidth: '100%', maxHeight: '100%' }} controls autoPlay muted loop />
                    ) : (
                        <img src={previewUrl} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="Preview" />
                    )}
                    <button 
                        onClick={handleRemoveFile}
                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', display: 'flex' }}
                    >
                        <Trash2 size={20} color="#ff3b30" />
                    </button>
                </div>
            )}

            <div style={{ marginBottom: '16px' }}>
                <textarea 
                    placeholder="Write a caption..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    style={{
                        width: '100%',
                        background: '#121212',
                        border: '1px solid #2c2c2e',
                        borderRadius: '12px',
                        padding: '16px',
                        color: '#fff',
                        minHeight: '100px',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                    }}
                />
            </div>

            <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#121212', border: '1px solid #2c2c2e', borderRadius: '12px', padding: '12px 16px' }}>
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
                            color: '#fff',
                            outline: 'none',
                            fontSize: '15px'
                        }}
                    />
                </div>
                <p style={{ fontSize: '12px', color: '#8e8e93', marginTop: '8px', paddingLeft: '4px' }}>
                    Users can swipe left on your post to open this link.
                </p>
            </div>

            <button 
                onClick={handleUpload}
                disabled={loading || !file}
                style={{
                    width: '100%',
                    background: loading || !file ? '#2c2c2e' : '#ff3366',
                    color: loading || !file ? '#8e8e93' : '#fff',
                    border: 'none',
                    borderRadius: '30px',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: loading || !file ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s'
                }}
            >
                {loading ? <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /> : 'Share Post'}
            </button>
        </div>
    );
};

export default CreatePost;
