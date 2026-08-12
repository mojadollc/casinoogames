import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const GAMES_PER_PAGE = 8;

/* ── Primitives ─────────────────────────────────────────── */
const Card = ({ children, style }) => (
  <div style={{ background: '#13131f', border: '1px solid #1e1e2e', borderRadius: '12px', ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: '11px', fontWeight: '700', color: '#555577', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
    {children}
  </div>
);

const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', fontSize: '12px', color: '#8888aa', marginBottom: '6px', fontWeight: '500' }}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: '11px', color: '#444466', marginTop: '4px' }}>{hint}</div>}
  </div>
);

const Input = (props) => (
  <input {...props} style={{
    width: '100%', padding: '10px 12px',
    background: '#0f0f1a', border: '1px solid #1e1e2e',
    borderRadius: '8px', color: '#e0e0f0', fontSize: '13px', outline: 'none',
    ...props.style,
  }} />
);

const Select = ({ children, ...props }) => (
  <select {...props} style={{
    width: '100%', padding: '10px 12px',
    background: '#0f0f1a', border: '1px solid #1e1e2e',
    borderRadius: '8px', color: '#e0e0f0', fontSize: '13px', outline: 'none',
    ...props.style,
  }}>{children}</select>
);

const Btn = ({ children, variant = 'default', sm, style, ...props }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    padding: sm ? '7px 14px' : '10px 18px',
    borderRadius: '8px', fontSize: sm ? '12px' : '13px', fontWeight: '600',
    cursor: 'pointer', border: 'none', transition: 'all 0.15s', whiteSpace: 'nowrap',
  };
  const variants = {
    default:  { background: '#1a1a2e', color: '#8888aa', border: '1px solid #1e1e2e' },
    primary:  { background: 'rgba(255,215,0,0.12)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.25)' },
    success:  { background: 'rgba(0,245,160,0.1)', color: '#00f5a0', border: '1px solid rgba(0,245,160,0.2)' },
    danger:   { background: 'rgba(255,71,87,0.1)', color: '#ff4757', border: '1px solid rgba(255,71,87,0.2)' },
    pink:     { background: 'rgba(255,45,117,0.1)', color: '#ff2d75', border: '1px solid rgba(255,45,117,0.2)' },
  };
  return <button {...props} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
};

const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)} style={{
    width: '44px', height: '24px', borderRadius: '12px', border: 'none',
    background: value ? '#00f5a0' : '#1e1e2e', position: 'relative', cursor: 'pointer', flexShrink: 0,
  }}>
    <div style={{
      position: 'absolute', width: '18px', height: '18px', borderRadius: '50%',
      background: 'white', top: '3px', left: value ? '23px' : '3px', transition: 'left 0.2s',
    }} />
  </button>
);

const Pagination = ({ page, total, perPage, onChange }) => {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const visible = Array.from({ length: pages }, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
      <PBtn disabled={page === 1} onClick={() => onChange(page - 1)}>‹</PBtn>
      {visible[0] > 1 && <><PBtn onClick={() => onChange(1)}>1</PBtn>{visible[0] > 2 && <span style={{ color: '#555577' }}>…</span>}</>}
      {visible.map(p => <PBtn key={p} active={p === page} onClick={() => onChange(p)}>{p}</PBtn>)}
      {visible[visible.length - 1] < pages && <><span style={{ color: '#555577' }}>…</span><PBtn onClick={() => onChange(pages)}>{pages}</PBtn></>}
      <PBtn disabled={page === pages} onClick={() => onChange(page + 1)}>›</PBtn>
      <span style={{ fontSize: '11px', color: '#555577', marginLeft: '8px' }}>
        {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
      </span>
    </div>
  );
};

const PBtn = ({ children, active, disabled, onClick }) => (
  <button onClick={onClick} disabled={disabled} style={{
    minWidth: '32px', height: '32px', padding: '0 8px', borderRadius: '6px',
    fontSize: '13px', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer',
    background: active ? 'rgba(255,215,0,0.15)' : '#1a1a2e',
    border: active ? '1px solid rgba(255,215,0,0.4)' : '1px solid #1e1e2e',
    color: active ? '#ffd700' : disabled ? '#333355' : '#8888aa',
  }}>{children}</button>
);

const StatusBadge = ({ status }) => {
  const map = { active: ['#00f5a0', 'rgba(0,245,160,0.1)', 'rgba(0,245,160,0.2)'], maintenance: ['#fee440', 'rgba(254,228,64,0.1)', 'rgba(254,228,64,0.2)'] };
  const [color, bg, border] = map[status] || ['#8888aa', 'rgba(136,136,170,0.1)', 'rgba(136,136,170,0.2)'];
  return <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: bg, color, border: `1px solid ${border}` }}>{status}</span>;
};

/* ── Modal wrapper ──────────────────────────────────────── */
const Modal = ({ title, onClose, children }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,1,13,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
    onClick={onClose}>
    <div style={{ background: '#13131f', border: '1px solid #1e1e2e', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto' }}
      onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#e0e0f0' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555577', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

/* ── Main Component ─────────────────────────────────────── */
export default function AdminGames() {
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [controls, setControls] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gamesPage, setGamesPage] = useState(1);

  // Global & Specific Win Rate State
  const [globalWinRate, setGlobalWinRate] = useState(35);
  const [globalForceOutcome, setGlobalForceOutcome] = useState('');
  const [applyingBulkForce, setApplyingBulkForce] = useState(false);
  const [bulkScope, setBulkScope] = useState('all'); // 'all', 'category', 'checked'
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all', 'slot', 'live', 'card', 'fishing'
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedGameIds, setCheckedGameIds] = useState([]);
  const [applyingBulk, setApplyingBulk] = useState(false);

  const [showForceModal, setShowForceModal] = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showJackpotModal, setShowJackpotModal] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editGame, setEditGame] = useState(null); // { id, name, rtp, min_bet, max_bet, thumbnail_url }
  const [thumbnailUploading, setThumbnailUploading] = useState(false);

  const [form, setForm] = useState({ name: '', slug: '', type: 'slot', rtp: 96, min_bet: 1, max_bet: 10000 });
  const [winRateInput, setWinRateInput] = useState({});
  const [forceForm, setForceForm] = useState({ user_id: '', outcome: 'win', spins: 1 });
  const [playerForm, setPlayerForm] = useState({ user_id: '', player_class: 'normal' });
  const [jackpotUserId, setJackpotUserId] = useState('');
  const [message, setMessage] = useState('');

  const loadGames = () => {
    setLoading(true);
    adminAPI.games().then(({ data }) => {
      setGames(data);
      // Only auto-select first game on initial load, not on every reload
      if (data.length > 0 && !selectedGame) selectGame(data[0].id);
    }).finally(() => setLoading(false));
  };

  const selectGame = async (id) => {
    // Cancel any pending debounced save for the previous game
    clearTimeout(saveTimerRef.current);
    saveControlsRef.current = {};
    setSelectedGame(id);
    try {
      const [cr, sr] = await Promise.all([adminAPI.getGameControls(id), adminAPI.getGameStats(id)]);
      setControls(cr.data);
      setStats(sr.data);
    } catch {}
  };

  useEffect(() => { loadGames(); }, []);

  const notify = (msg) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

  // Per-game win rate: update local state on change, save to DB on blur
  const handleSpecificWinRateChange = (gameId, val) => {
    setWinRateInput(prev => ({ ...prev, [gameId]: val }));
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, win_rate: val } : g));
  };

  const handleSpecificWinRateBlur = async (gameId, val) => {
    const rate = Math.min(100, Math.max(0, parseInt(val) || 0));
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, win_rate: rate } : g));
    setWinRateInput(prev => ({ ...prev, [gameId]: rate }));
    if (selectedGame === gameId && controls) setControls(prev => ({ ...prev, win_rate: rate }));
    try {
      await adminAPI.setGameControls(gameId, { win_rate: rate });
      notify(`✓ Win rate set to ${rate}%`);
    } catch { notify('✗ Failed to update win rate'); }
  };

  // Bulk Win Rate adjustment across all or selected games
  const handleBulkWinRateApply = async () => {
    setApplyingBulk(true);
    let targetIds = [];
    if (bulkScope === 'checked') {
      targetIds = checkedGameIds;
      if (targetIds.length === 0) {
        notify('⚠️ Please select at least one game with checkbox');
        setApplyingBulk(false);
        return;
      }
    } else if (bulkScope === 'category') {
      targetIds = filteredGames.map(g => g.id);
    } else {
      targetIds = games.map(g => g.id);
    }

    try {
      await adminAPI.bulkSetWinRate(globalWinRate, targetIds);
      notify(`⚡ Win rate set to ${globalWinRate}% for ${targetIds.length} game(s)`);
      // Update local game list without re-fetching (avoids wiping controls panel)
      setGames(prev => prev.map(g => targetIds.includes(g.id) ? { ...g, win_rate: globalWinRate } : g));
      // Refresh controls panel for selected game if it was affected
      if (selectedGame && targetIds.includes(selectedGame)) {
        setControls(prev => prev ? { ...prev, win_rate: globalWinRate } : prev);
      }
    } catch {
      notify('✗ Failed to apply bulk win rate');
    } finally {
      setApplyingBulk(false);
    }
  };

  const filteredGames = games.filter(g => {
    const matchesCategory = selectedCategory === 'all' ||
      g.type === selectedCategory ||
      (selectedCategory === 'slot' && (g.type === 'slot' || g.type === 'slots'));
    const matchesSearch = !searchQuery ||
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.slug.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleCheckAll = () => {
    const visibleIds = filteredGames.map(g => g.id);
    const allChecked = visibleIds.length > 0 && visibleIds.every(id => checkedGameIds.includes(id));
    if (allChecked) {
      setCheckedGameIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setCheckedGameIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleCheckGame = (gameId) => {
    setCheckedGameIds(prev => prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]);
  };

  const createGame = async (e) => {
    e.preventDefault();
    await adminAPI.createGame(form);
    setShowCreate(false);
    setForm({ name: '', slug: '', type: 'slot', rtp: 96, min_bet: 1, max_bet: 10000 });
    loadGames();
  };

  const saveEditGame = async (e) => {
    e.preventDefault();
    const { id, name, rtp, min_bet, max_bet } = editGame;
    await adminAPI.updateGame(id, { name, rtp: parseFloat(rtp), min_bet: parseFloat(min_bet), max_bet: parseFloat(max_bet) });
    notify('✓ Game updated');
    setEditGame(null);
    loadGames();
  };

  const handleThumbnailUpload = async (gameId, file) => {
    if (!file) return;
    setThumbnailUploading(true);
    try {
      const res = await adminAPI.uploadGameThumbnail(gameId, file);
      notify('✓ Thumbnail uploaded');
      setGames(prev => prev.map(g => g.id === gameId ? { ...g, thumbnail_url: res.data.thumbnailUrl } : g));
      if (editGame?.id === gameId) setEditGame(prev => ({ ...prev, thumbnail_url: res.data.thumbnailUrl }));
    } catch { notify('✗ Upload failed'); }
    finally { setThumbnailUploading(false); }
  };

  const toggleStatus = async (id, current) => {
    await adminAPI.updateGame(id, { status: current === 'active' ? 'maintenance' : 'active' });
    loadGames();
  };

  const saveControlsRef = React.useRef({});
  const saveTimerRef = React.useRef(null);

  const updateControls = (field, value) => {
    setControls(prev => ({ ...prev, [field]: value }));
    // Also update the games list so win_rate column stays in sync
    if (field === 'win_rate') {
      setGames(prev => prev.map(g => g.id === selectedGame ? { ...g, win_rate: value } : g));
    }
    saveControlsRef.current[field] = value;
    // Debounce: wait 800ms after last change before saving
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const pending = { ...saveControlsRef.current };
      saveControlsRef.current = {};
      try {
        await adminAPI.setGameControls(selectedGame, pending);
        notify('✓ Settings saved');
      } catch { notify('✗ Failed to update'); }
    }, 800);
  };

  const updateGameRTP = async (rtp) => {
    const val = parseFloat(rtp);
    if (isNaN(val) || val < 0 || val > 100) return;
    setGames(prev => prev.map(g => g.id === selectedGame ? { ...g, rtp: val } : g));
    try {
      await adminAPI.updateGame(selectedGame, { rtp: val });
      notify('✓ RTP updated');
    } catch { notify('✗ Failed to update RTP'); }
  };

  const handleForceOutcome = async (e) => {
    e.preventDefault();
    try {
      const res = await adminAPI.forceOutcome(selectedGame, forceForm);
      notify(`✓ ${res.data.message}`);
      setShowForceModal(false);
      setForceForm({ user_id: '', outcome: 'win', spins: 1 });
    } catch { notify('✗ Failed to force outcome'); }
  };

  const handleSetPlayerClass = async (e) => {
    e.preventDefault();
    try {
      const res = await adminAPI.setPlayerClass(selectedGame, playerForm);
      notify(`✓ ${res.data.message}`);
      setShowPlayerModal(false);
      setPlayerForm({ user_id: '', player_class: 'normal' });
    } catch { notify('✗ Failed to set player class'); }
  };

  const handleTriggerJackpot = async (e) => {
    e.preventDefault();
    try {
      const res = await adminAPI.triggerJackpot(selectedGame, jackpotUserId);
      notify(`✓ ${res.data.message}`);
      setShowJackpotModal(false);
      setJackpotUserId('');
    } catch { notify('✗ Failed to trigger jackpot'); }
  };

  const pagedGames = filteredGames.slice((gamesPage - 1) * GAMES_PER_PAGE, gamesPage * GAMES_PER_PAGE);
  const selectedGameObj = games.find(g => g.id === selectedGame);

  return (
    <div style={{ maxWidth: '1280px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#e0e0f0', marginBottom: '4px' }}>Game Controls</h1>
          <p style={{ fontSize: '13px', color: '#555577' }}>Manage games, RTP, and player outcomes</p>
        </div>
        <Btn variant="primary" onClick={() => setShowCreate(true)}>+ Add Game</Btn>
      </div>

      {/* ── Global Win Rate Panel ── */}
      <Card style={{ padding: '20px', marginBottom: '20px' }}>
        <SectionTitle>⚡ Win Rate Adjustment</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          {/* Scope */}
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8888aa', marginBottom: '6px', fontWeight: '500' }}>Apply To</label>
            <Select value={bulkScope} onChange={e => setBulkScope(e.target.value)} style={{ width: '160px' }}>
              <option value="all">All Games</option>
              <option value="category">By Category</option>
              <option value="checked">Selected ({checkedGameIds.length})</option>
            </Select>
          </div>

          {bulkScope === 'category' && (
            <div style={{ flex: '0 0 auto' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#8888aa', marginBottom: '6px', fontWeight: '500' }}>Category</label>
              <Select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setGamesPage(1); }} style={{ width: '140px' }}>
                <option value="all">All</option>
                <option value="slot">Slot</option>
                <option value="live">Live Casino</option>
                <option value="fishing">Fishing</option>
                <option value="card">Card</option>
                <option value="table">Table</option>
                <option value="poker">Poker</option>
                <option value="roulette">Roulette</option>
              </Select>
            </div>
          )}

          <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8888aa', marginBottom: '6px', fontWeight: '500' }}>Win Rate — <span style={{ color: '#ffd700', fontWeight: '700' }}>{globalWinRate}%</span></label>
            <input type="range" min="0" max="100" value={globalWinRate}
              onChange={e => setGlobalWinRate(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#ffd700' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#444466', marginTop: '2px' }}>
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>

          <div style={{ flex: '0 0 auto' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8888aa', marginBottom: '6px', fontWeight: '500' }}>Exact %</label>
            <Input type="number" min="0" max="100" value={globalWinRate}
              onChange={e => setGlobalWinRate(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              style={{ width: '80px' }}
            />
          </div>

          <Btn variant="primary" onClick={handleBulkWinRateApply} disabled={applyingBulk} style={{ flex: '0 0 auto', height: '40px' }}>
            {applyingBulk ? '⏳ Applying…' : '⚡ Apply'}
          </Btn>
        </div>
      </Card>

      {/* ── Global Force Outcome Panel ── */}
      <Card style={{ padding: '20px', marginBottom: '20px', border: globalForceOutcome === 'loss' ? '1px solid rgba(255,71,87,0.5)' : '1px solid #1e1e2e', background: globalForceOutcome === 'loss' ? 'rgba(255,71,87,0.05)' : '#13131f' }}>
        <SectionTitle>🔒 Force Outcome — ALL Games</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8888aa', marginBottom: '6px', fontWeight: '500' }}>Force All Spins To</label>
            <Select value={globalForceOutcome} onChange={e => setGlobalForceOutcome(e.target.value)}
              style={{ borderColor: globalForceOutcome === 'loss' ? 'rgba(255,71,87,0.5)' : '#1e1e2e' }}>
              <option value="">🎲 Random (Normal)</option>
              <option value="win">✅ Force All Wins</option>
              <option value="loss">❌ Force All Losses</option>
            </Select>
          </div>
          <Btn
            variant={globalForceOutcome === 'loss' ? 'danger' : globalForceOutcome === 'win' ? 'success' : 'default'}
            disabled={applyingBulkForce}
            style={{ flex: '0 0 auto', height: '40px' }}
            onClick={async () => {
              setApplyingBulkForce(true);
              try {
                const targetIds = bulkScope === 'checked' ? checkedGameIds
                  : bulkScope === 'category' ? filteredGames.map(g => g.id)
                  : games.map(g => g.id);
                await adminAPI.bulkSetForceOutcome(globalForceOutcome || null, targetIds);
                notify(`✓ Force outcome set to "${globalForceOutcome || 'random'}" for ${targetIds.length} game(s)`);
                // Update controls panel directly without reloading
                if (selectedGame && targetIds.includes(selectedGame)) {
                  setControls(prev => prev ? { ...prev, force_outcome: globalForceOutcome || null } : prev);
                }
              } catch { notify('✗ Failed to apply force outcome'); }
              finally { setApplyingBulkForce(false); }
            }}>
            {applyingBulkForce ? '⏳ Applying…' : '🔒 Apply to All Games'}
          </Btn>
          {globalForceOutcome === 'loss' && (
            <div style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: '8px', fontSize: '12px', color: '#ff4757', fontWeight: '600' }}>
              ⚠️ ACTIVE: All games will force 100% losses. Players cannot win anything.
            </div>
          )}
        </div>
      </Card>

      {/* Search bar */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
        <Input placeholder="🔍 Search games…" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setGamesPage(1); }} style={{ maxWidth: '280px' }} />
        {bulkScope !== 'category' && (
          <Select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setGamesPage(1); }} style={{ width: '140px' }}>
            <option value="all">All Types</option>
            <option value="slot">Slot</option>
            <option value="live">Live Casino</option>
            <option value="fishing">Fishing</option>
            <option value="card">Card</option>
            <option value="table">Table</option>
            <option value="poker">Poker</option>
            <option value="roulette">Roulette</option>
          </Select>
        )}
      </div>

      {/* Toast */}
      {message && (
        <div style={{
          padding: '12px 16px', marginBottom: '20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
          background: message.startsWith('✓') ? 'rgba(0,245,160,0.08)' : 'rgba(255,71,87,0.08)',
          border: `1px solid ${message.startsWith('✓') ? 'rgba(0,245,160,0.2)' : 'rgba(255,71,87,0.2)'}`,
          color: message.startsWith('✓') ? '#00f5a0' : '#ff4757',
        }}>{message}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', alignItems: 'start' }}>
        {/* Left: Games Table */}
        <div>
          <Card>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionTitle>All Games</SectionTitle>
              <span style={{ fontSize: '12px', color: '#555577' }}>{games.length} total</span>
            </div>

            {loading ? (
              <div className="loading"><div className="spinner" /></div>
            ) : games.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#555577' }}>No games registered yet</div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1e1e2e' }}>
                        <th style={{ padding: '12px 12px 12px 20px', width: '36px' }}>
                          <input type="checkbox"
                            checked={filteredGames.length > 0 && filteredGames.every(g => checkedGameIds.includes(g.id))}
                            onChange={toggleCheckAll}
                            style={{ accentColor: '#ffd700', cursor: 'pointer' }}
                          />
                        </th>
                        {['Game', 'Type', 'RTP', 'Win Rate', 'Bet Range', 'Status', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '12px 20px', textAlign: 'left', color: '#555577', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedGames.map(g => (
                        <tr key={g.id}
                          style={{ borderBottom: '1px solid #1a1a2a', background: selectedGame === g.id ? 'rgba(255,215,0,0.04)' : 'transparent', cursor: 'pointer' }}
                          onClick={() => selectGame(g.id)}
                          onMouseEnter={e => { if (selectedGame !== g.id) e.currentTarget.style.background = '#0f0f1a'; }}
                          onMouseLeave={e => { if (selectedGame !== g.id) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '14px 12px 14px 20px' }} onClick={e => e.stopPropagation()}>
                            <input type="checkbox"
                              checked={checkedGameIds.includes(g.id)}
                              onChange={() => toggleCheckGame(g.id)}
                              style={{ accentColor: '#ffd700', cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {/* Thumbnail preview */}
                              <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', background: '#0f0f1a', border: '1px solid #1e1e2e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {g.thumbnail_url
                                  ? <img src={g.thumbnail_url} alt={g.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <span style={{ fontSize: '18px' }}>🎮</span>}
                              </div>
                              <div>
                                <div style={{ fontWeight: '600', color: selectedGame === g.id ? '#ffd700' : '#e0e0f0' }}>{g.name}</div>
                                <div style={{ fontSize: '11px', color: '#555577' }}>/{g.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px', color: '#8888aa', textTransform: 'capitalize' }}>{g.type}</td>
                          <td style={{ padding: '14px 20px', color: '#e0e0f0', fontWeight: '600' }}>{g.rtp}%</td>
                          <td style={{ padding: '14px 20px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input type="number" min="0" max="100"
                                value={winRateInput[g.id] ?? g.win_rate ?? 35}
                                onChange={e => handleSpecificWinRateChange(g.id, e.target.value)}
                                onBlur={e => handleSpecificWinRateBlur(g.id, e.target.value)}
                                style={{
                                  width: '60px', padding: '5px 8px',
                                  background: '#0f0f1a', border: '1px solid #1e1e2e',
                                  borderRadius: '6px', color: '#ffd700', fontSize: '13px',
                                  fontWeight: '700', outline: 'none', textAlign: 'center',
                                }}
                              />
                              <span style={{ fontSize: '11px', color: '#555577' }}>%</span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px', color: '#8888aa', whiteSpace: 'nowrap' }}>₱{g.min_bet}–₱{g.max_bet}</td>
                          <td style={{ padding: '14px 20px' }}><StatusBadge status={g.status} /></td>
                          <td style={{ padding: '14px 20px' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <Btn sm variant={g.status === 'active' ? 'danger' : 'success'} onClick={() => toggleStatus(g.id, g.status)}>
                                {g.status === 'active' ? '⏸' : '▶'}
                              </Btn>
                              <Btn sm variant="primary" onClick={() => setEditGame({ id: g.id, name: g.name, rtp: g.rtp, min_bet: g.min_bet, max_bet: g.max_bet, thumbnail_url: g.thumbnail_url })}>
                                ✏️
                              </Btn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1e2e' }}>
                  <Pagination page={gamesPage} total={filteredGames.length} perPage={GAMES_PER_PAGE} onChange={setGamesPage} />
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Right: Control Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Stats */}
          {stats && (
            <Card style={{ padding: '20px' }}>
              <SectionTitle>Last 24 Hours — {selectedGameObj?.name}</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Spins',      value: parseInt(stats.total_spins) || 0,                    color: '#ffd700' },
                  { label: 'Paid Out',   value: `₱${parseFloat(stats.total_wins || 0).toLocaleString()}`, color: '#00f5a0' },
                  { label: 'Actual RTP', value: `${stats.rtp_actual}%`,                              color: '#ff2d75' },
                  { label: 'Win Rate',   value: `${stats.win_rate}%`,                                color: '#a78bfa' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '12px', background: '#0f0f1a', borderRadius: '8px', border: '1px solid #1e1e2e', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: '800', color }}>{value}</div>
                    <div style={{ fontSize: '10px', color: '#555577', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Controls */}
          {controls && (
            <Card style={{ padding: '20px' }}>
              <SectionTitle>Control Settings</SectionTitle>

              {/* RTP */}
              <Field label="RTP (%)" hint="Theoretical return to player — applied to game engine">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Input type="number" min="0" max="100" step="0.01"
                    defaultValue={selectedGameObj?.rtp ?? 96}
                    key={selectedGame}
                    onBlur={e => updateGameRTP(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '12px', color: '#555577', whiteSpace: 'nowrap' }}>current: {selectedGameObj?.rtp}%</span>
                </div>
              </Field>

              {/* Win Rate */}
              <Field label={`Win Rate — ${controls.win_rate}%`}>
                <input type="range" min="0" max="100" value={controls.win_rate}
                  onChange={e => updateControls('win_rate', parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#ffd700' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#444466', marginTop: '4px' }}>
                  <span>0% — No wins</span><span>100% — Always win</span>
                </div>
              </Field>

              {/* Force Outcome */}
              <Field label="Force All Spins" hint={controls.force_outcome ? `⚠️ Active: ${controls.force_outcome.toUpperCase()} forced on all spins` : 'Normal random mode'}>
                <Select value={controls.force_outcome || ''} onChange={e => updateControls('force_outcome', e.target.value || null)}>
                  <option value="">🎲 Random (Normal)</option>
                  <option value="win">✅ Force All Wins</option>
                  <option value="loss">❌ Force All Losses</option>
                  <option value="jackpot">🏆 Force Jackpot</option>
                </Select>
              </Field>

              {/* Payout Limits */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="Min Payout (×bet)">
                  <Input type="number" min="0" max="100" step="0.5" value={controls.min_payout}
                    onChange={e => updateControls('min_payout', parseFloat(e.target.value))} />
                </Field>
                <Field label="Max Payout (×bet)">
                  <Input type="number" min="1" max="10000" value={controls.max_payout}
                    onChange={e => updateControls('max_payout', parseFloat(e.target.value))} />
                </Field>
              </div>

              {/* Payout Cap */}
              <Field label="Payout Cap / Session (₱)" hint="0 = unlimited">
                <Input type="number" min="0" placeholder="0 = unlimited" value={controls.payout_cap}
                  onChange={e => updateControls('payout_cap', parseFloat(e.target.value))} />
              </Field>

              {/* Demo Mode */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#0f0f1a', borderRadius: '8px', border: '1px solid #1e1e2e' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#e0e0f0' }}>Demo Mode</div>
                  <div style={{ fontSize: '11px', color: '#555577' }}>No real money transactions</div>
                </div>
                <Toggle value={controls.dry_run} onChange={v => updateControls('dry_run', v)} />
              </div>
            </Card>
          )}

          {/* Quick Actions */}
          {selectedGame && (
            <Card style={{ padding: '20px' }}>
              <SectionTitle>Quick Actions</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => setShowForceModal(true)} style={qaBtn('#ffd700', 'rgba(255,215,0,0.1)', 'rgba(255,215,0,0.25)')}>
                  <span style={{ fontSize: '16px' }}>🎯</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>Force Win / Loss</div>
                    <div style={{ fontSize: '11px', opacity: 0.7 }}>Override next spin for a player</div>
                  </div>
                </button>
                <button onClick={() => setShowPlayerModal(true)} style={qaBtn('#a78bfa', 'rgba(167,139,250,0.1)', 'rgba(167,139,250,0.25)')}>
                  <span style={{ fontSize: '16px' }}>👤</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>Set Player Class</div>
                    <div style={{ fontSize: '11px', opacity: 0.7 }}>VIP, Normal, or Low odds</div>
                  </div>
                </button>
                <button onClick={() => setShowJackpotModal(true)} style={qaBtn('#ff2d75', 'rgba(255,45,117,0.1)', 'rgba(255,45,117,0.25)')}>
                  <span style={{ fontSize: '16px' }}>🏆</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>Trigger Jackpot</div>
                    <div style={{ fontSize: '11px', opacity: 0.7 }}>Award jackpot on next spin</div>
                  </div>
                </button>
                <button onClick={loadGames} style={qaBtn('#8888aa', 'rgba(136,136,170,0.08)', 'rgba(136,136,170,0.2)')}>
                  <span style={{ fontSize: '16px' }}>🔄</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>Refresh Stats</div>
                    <div style={{ fontSize: '11px', opacity: 0.7 }}>Reload 24h game data</div>
                  </div>
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showForceModal && (
        <Modal title="🎯 Force Outcome" onClose={() => setShowForceModal(false)}>
          <p style={{ fontSize: '13px', color: '#555577', marginBottom: '20px' }}>Force the next spin(s) to a specific outcome for a player.</p>
          <form onSubmit={handleForceOutcome}>
            <Field label="User ID"><Input type="text" value={forceForm.user_id} onChange={e => setForceForm({ ...forceForm, user_id: e.target.value })} placeholder="Paste user UUID" required /></Field>
            <Field label="Outcome">
              <Select value={forceForm.outcome} onChange={e => setForceForm({ ...forceForm, outcome: e.target.value })}>
                <option value="win">✅ Win</option>
                <option value="loss">❌ Loss</option>
                <option value="big_win">⭐ Big Win</option>
                <option value="jackpot">🏆 Jackpot</option>
              </Select>
            </Field>
            <Field label="Number of Spins"><Input type="number" min="1" max="100" value={forceForm.spins} onChange={e => setForceForm({ ...forceForm, spins: parseInt(e.target.value) })} /></Field>
            <Btn variant="primary" style={{ width: '100%' }} type="submit">Apply Force Outcome</Btn>
          </form>
        </Modal>
      )}

      {showPlayerModal && (
        <Modal title="👤 Set Player Class" onClose={() => setShowPlayerModal(false)}>
          <p style={{ fontSize: '13px', color: '#555577', marginBottom: '20px' }}>VIP = 10% win bonus + better odds · Low = Reduced winning chance</p>
          <form onSubmit={handleSetPlayerClass}>
            <Field label="User ID"><Input type="text" value={playerForm.user_id} onChange={e => setPlayerForm({ ...playerForm, user_id: e.target.value })} placeholder="Paste user UUID" required /></Field>
            <Field label="Player Class">
              <Select value={playerForm.player_class} onChange={e => setPlayerForm({ ...playerForm, player_class: e.target.value })}>
                <option value="vip">👑 VIP (Better Odds + 10% Bonus)</option>
                <option value="normal">👤 Normal (Standard)</option>
                <option value="low">🔻 Low (Reduced Winning)</option>
              </Select>
            </Field>
            <Btn variant="primary" style={{ width: '100%' }} type="submit">Set Class</Btn>
          </form>
        </Modal>
      )}

      {showJackpotModal && (
        <Modal title="🏆 Trigger Jackpot" onClose={() => setShowJackpotModal(false)}>
          <p style={{ fontSize: '13px', color: '#555577', marginBottom: '20px' }}>Manually award jackpot to a player on their next spin.</p>
          <form onSubmit={handleTriggerJackpot}>
            <Field label="User ID"><Input type="text" value={jackpotUserId} onChange={e => setJackpotUserId(e.target.value)} placeholder="Paste user UUID" required /></Field>
            <div style={{ padding: '12px', background: 'rgba(255,71,87,0.06)', borderRadius: '8px', border: '1px solid rgba(255,71,87,0.15)', marginBottom: '16px', fontSize: '12px', color: '#8888aa' }}>
              ⚠️ This will trigger jackpot on the player's next spin regardless of actual outcome.
            </div>
            <Btn variant="pink" style={{ width: '100%' }} type="submit">🏆 Trigger Jackpot</Btn>
          </form>
        </Modal>
      )}

      {showCreate && (
        <Modal title="Create New Game" onClose={() => setShowCreate(false)}>
          <form onSubmit={createGame}>
            <Field label="Name"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} required /></Field>
            <Field label="Slug"><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} required /></Field>
            <Field label="Type">
              <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="slot">Slot</option>
                <option value="live">Live Casino</option>
                <option value="fishing">Fishing</option>
                <option value="card">Card</option>
                <option value="table">Table</option>
                <option value="poker">Poker</option>
                <option value="roulette">Roulette</option>
              </Select>
            </Field>
            <Field label="RTP (%)"><Input type="number" step="0.01" value={form.rtp} onChange={e => setForm({ ...form, rtp: e.target.value })} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Min Bet"><Input type="number" value={form.min_bet} onChange={e => setForm({ ...form, min_bet: e.target.value })} /></Field>
              <Field label="Max Bet"><Input type="number" value={form.max_bet} onChange={e => setForm({ ...form, max_bet: e.target.value })} /></Field>
            </div>
            <Btn variant="primary" style={{ width: '100%' }} type="submit">Create Game</Btn>
          </form>
        </Modal>
      )}

      {editGame && (
        <Modal title={`✏️ Edit — ${editGame.name}`} onClose={() => setEditGame(null)}>
          {/* Thumbnail section */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#8888aa', marginBottom: '8px', fontWeight: '500' }}>Thumbnail Image</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', background: '#0f0f1a', border: '1px solid #1e1e2e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {editGame.thumbnail_url
                  ? <img src={editGame.thumbnail_url} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '32px' }}>🎮</span>}
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', padding: '10px 14px', background: 'rgba(255,215,0,0.08)', border: '1px dashed rgba(255,215,0,0.3)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontSize: '12px', color: '#ffd700' }}>
                  {thumbnailUploading ? '⏳ Uploading…' : '📁 Choose Image (JPG/PNG/WebP, max 5MB)'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }}
                    onChange={e => handleThumbnailUpload(editGame.id, e.target.files[0])}
                    disabled={thumbnailUploading}
                  />
                </label>
                {editGame.thumbnail_url && (
                  <div style={{ fontSize: '11px', color: '#555577', marginTop: '4px', wordBreak: 'break-all' }}>{editGame.thumbnail_url}</div>
                )}
              </div>
            </div>
          </div>
          <form onSubmit={saveEditGame}>
            <Field label="Name"><Input value={editGame.name} onChange={e => setEditGame(p => ({ ...p, name: e.target.value }))} required /></Field>
            <Field label="RTP (%)"><Input type="number" step="0.01" min="0" max="100" value={editGame.rtp} onChange={e => setEditGame(p => ({ ...p, rtp: e.target.value }))} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Min Bet"><Input type="number" value={editGame.min_bet} onChange={e => setEditGame(p => ({ ...p, min_bet: e.target.value }))} /></Field>
              <Field label="Max Bet"><Input type="number" value={editGame.max_bet} onChange={e => setEditGame(p => ({ ...p, max_bet: e.target.value }))} /></Field>
            </div>
            <Btn variant="primary" style={{ width: '100%' }} type="submit">Save Changes</Btn>
          </form>
        </Modal>
      )}
    </div>
  );
}

function qaBtn(color, bg, border) {
  return {
    display: 'flex', alignItems: 'center', gap: '12px',
    width: '100%', padding: '12px 14px', borderRadius: '9px',
    background: bg, border: `1px solid ${border}`, color,
    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
  };
}
