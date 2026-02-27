
import React from 'react';
import { Home, Search, Library, Heart, Download } from 'lucide-react';
import Logo from './Logo';

export default function Sidebar({ activeTab, setActiveTab, playlists }) {
    return (
        <aside style={{ width: '280px', background: '#000', padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: '24px', borderRight: '1px solid #121212' }}>
            <div style={{ padding: '0 12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontWeight: '900', fontSize: '24px', letterSpacing: '-1.5px' }}>
                    <div style={{
                        width: '36px', height: '36px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <Logo size={40} />
                    </div> SONANCE
                </div>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className={`nav-link ${activeTab === 'EXPLORE' ? 'active' : ''}`} onClick={() => setActiveTab('EXPLORE')}>
                    <Home size={24} /> Inicio
                </div>
                <div className={`nav-link ${activeTab === 'EXPLORE' ? 'active' : ''}`} onClick={() => setActiveTab('EXPLORE')}>
                    <Search size={24} /> Buscar
                </div>
                <div className={`nav-link ${activeTab === 'PLAYLISTS' ? 'active' : ''}`} onClick={() => setActiveTab('PLAYLISTS')}>
                    <Library size={24} /> Tu Biblioteca
                </div>
                <a href="/sonance.apk" download="Sonance.apk" style={{ textDecoration: 'none' }}>
                    <div className="nav-link" style={{ color: 'var(--s-primary)' }}>
                        <Download size={24} /> Instalar APK
                    </div>
                </a>
            </nav>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                <div className={`nav-link ${activeTab === 'FAVORITES' ? 'active' : ''}`} onClick={() => setActiveTab('FAVORITES')}>
                    <div style={{ background: 'linear-gradient(135deg, #450af5, #c4efd9)', padding: '6px', borderRadius: '2px' }}>
                        <Heart size={16} fill="white" color="white" />
                    </div>
                    Tus me gusta
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #282828', paddingTop: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#b3b3b3', padding: '12px', textTransform: 'uppercase' }}>Playlists</div>
                {Object.keys(playlists).map(name => (
                    <div key={name} className={`playlist-item ${activeTab === 'PLAYLISTS' ? 'active' : ''}`} onClick={() => setActiveTab('PLAYLISTS')}>
                        {name}
                    </div>
                ))}
            </div>
        </aside>
    );
}
