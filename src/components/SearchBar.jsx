
import React from 'react';
import { Search, X, Settings } from 'lucide-react';

export default function SearchBar({ query, setQuery, handleSearch, clearSearch, isMobile, status, isPlaying, changeName }) {
    return (
        <header style={{ 
            position: 'sticky', 
            top: 0, 
            paddingTop: isMobile ? 'calc(10px + env(safe-area-inset-top))' : '16px',
            paddingBottom: isMobile ? '10px' : '16px',
            paddingLeft: isMobile ? '12px' : '32px',
            paddingRight: isMobile ? '12px' : '32px',
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: 'rgba(12,12,12,0.85)', 
            backdropFilter: 'blur(30px) saturate(150%)', 
            zIndex: 10,
            borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
            <form
                action=""
                onSubmit={(e) => { e.preventDefault(); handleSearch(e); if (isMobile) document.activeElement.blur(); }}
                style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#fff', opacity: 0.6 }} />
                    <input
                        type="search"
                        enterKeyHint="search"
                        placeholder="Artistas, canciones..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{
                            width: '100%', 
                            background: 'rgba(255,255,255,0.07)', 
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '500px', 
                            padding: '0 44px', 
                            color: '#fff', 
                            fontSize: '16px', 
                            fontWeight: '500', 
                            outline: 'none', 
                            height: '46px', 
                            lineHeight: 'normal', 
                            backdropFilter: 'blur(10px)',
                            WebkitAppearance: 'none',
                            boxShadow: 'none'
                        }}
                    />
                    {query && (
                        <X size={18} onClick={() => setQuery('')} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#fff', opacity: 0.6, cursor: 'pointer' }} />
                    )}
                </div>
                {isMobile && query && (
                    <div onClick={clearSearch} style={{ color: '#fff', fontSize: '15px', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer', padding: '0 4px' }}>
                        Cancelar
                    </div>
                )}
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {!isMobile && (
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: isPlaying ? 'var(--s-primary)' : '#fa233b' }}>
                        {status.toUpperCase()}
                    </div>
                )}
                <Settings size={20} onClick={changeName} className="icon-btn" style={{ opacity: 0.6 }} />
            </div>
        </header>
    );
}
