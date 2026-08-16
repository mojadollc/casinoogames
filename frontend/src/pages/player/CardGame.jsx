import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../hooks/useSocket';
import useCardSounds from '../../components/cards/useCardSounds';

const SUITS = {
  hearts: { symbol: '♥', color: '#e74c3c' },
  diamonds: { symbol: '♦', color: '#e74c3c' },
  clubs: { symbol: '♣', color: '#2c3e50' },
  spades: { symbol: '♠', color: '#2c3e50' },
};

const CHIP_VALUES = [10, 25, 50, 100, 500, 1000];

const Card = ({ card, faceDown = false, small = false, animate = false, winHighlight = false }) => {
  if (!card || faceDown || card.faceDown) {
    return (
      <div style={{
        width: small ? 40 : 60, height: small ? 56 : 84, borderRadius: 8,
        background: 'linear-gradient(135deg, #1a3a2a, #0d2818)',
        border: '2px solid #2d5a3d', boxShadow: '0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
        animation: animate ? 'cardFlip 0.6s ease-in-out' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {winHighlight && <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(circle at center, rgba(255,215,0,0.3) 0%, transparent 70%)',
          animation: 'goldPulse 1.5s ease-in-out infinite',
        }} />}
      </div>
    );
  }
  const meta = SUITS[card.suit] || SUITS.spades;
  return (
    <div style={{
      width: small ? 40 : 60, height: small ? 56 : 84, borderRadius: 8,
      background: '#fff', border: '2px solid #ddd',
      boxShadow: winHighlight ? '0 0 20px rgba(255,215,0,0.8), 0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: small ? 3 : 5, color: meta.color, fontWeight: 900, fontSize: small ? 11 : 14,
      animation: animate ? 'cardFlip 0.6s ease-in-out' : (winHighlight ? 'winCardGlow 1.2s ease-in-out infinite' : 'none'),
      position: 'relative',
      overflow: 'hidden',
    }}>
      {winHighlight && <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at center, rgba(255,215,0,0.2) 0%, transparent 70%)',
        animation: 'goldPulse 1.5s ease-in-out infinite',
      }} />}
      <div style={{ lineHeight: 1, position: 'relative', zIndex: 1 }}>{card.rank}{meta.symbol}</div>
      <div style={{ textAlign: 'center', fontSize: small ? 18 : 28, lineHeight: 1, position: 'relative', zIndex: 1 }}>{meta.symbol}</div>
      <div style={{ transform: 'rotate(180deg)', lineHeight: 1, position: 'relative', zIndex: 1 }}>{card.rank}{meta.symbol}</div>
    </div>
  );
};

function Hand({ cards, label, value, highlight, winHighlight = false }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: highlight ? '#FFD700' : '#8ab', marginBottom: 4, fontWeight: 700 }}>
        {label}{value != null ? ` · ${value}` : ''}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {(cards || []).map((c, i) => <Card key={i} card={c} faceDown={c.faceDown} small winHighlight={winHighlight} />)}
        {(!cards || !cards.length) && <span style={{ color: '#567', fontSize: 12 }}>—</span>}
      </div>
    </div>
  );
}

function WinDisplay({ amount, betAmount, resultType }) {
  const winRatio = betAmount > 0 ? amount / betAmount : 0;
  let winSize = 'small';
  let emoji = '🎉';
  let animation = 'winPulse 1.2s ease-in-out infinite';
  let fontSize = 16;
  let gradient = 'linear-gradient(135deg, #FFD700, #f0a500)';
  
  if (winRatio >= 10) {
    winSize = 'mega';
    emoji = '🏆';
    animation = 'megaWin 1.5s ease-in-out infinite';
    fontSize = 20;
    gradient = 'linear-gradient(135deg, #FFD700, #FF6B00, #FFD700)';
  } else if (winRatio >= 5) {
    winSize = 'big';
    emoji = '💰';
    animation = 'bigWin 1.3s ease-in-out infinite';
    fontSize = 18;
    gradient = 'linear-gradient(135deg, #FFD700, #FFA500)';
  } else if (winRatio >= 2) {
    winSize = 'medium';
    emoji = '💸';
    animation = 'mediumWin 1.2s ease-in-out infinite';
    fontSize = 17;
  }
  
  if (resultType === 'blackjack') {
    emoji = '🃏';
    winSize = 'blackjack';
    animation = 'blackjackWin 1.4s ease-in-out infinite';
    gradient = 'linear-gradient(135deg, #FFD700, #00FF00, #FFD700)';
  }

  return (
    <div style={{
      textAlign: 'center', fontWeight: 900, fontSize: fontSize,
      color: '#1a1200', padding: '12px 16px', borderRadius: 12,
      background: gradient,
      animation: animation,
      marginBottom: 10,
      boxShadow: '0 4px 20px rgba(255,215,0,0.5)',
      border: '2px solid rgba(255,255,255,0.3)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%)',
        animation: 'shine 2s linear infinite',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {emoji} {resultType === 'blackjack' ? 'BLACKJACK!' : 'WIN!'} ₱{amount.toLocaleString()} {emoji}
      </div>
      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.9, position: 'relative', zIndex: 1 }}>
        {winSize.toUpperCase()} WIN • {winRatio.toFixed(1)}x MULTIPLIER
      </div>
    </div>
  );
}

export default function CardGame() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socketRef = useRef(null);
  const { play: playSound } = useCardSounds();
  const [lastWin, setLastWin] = useState(null);

  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [view, setView] = useState('lobby');
  const [tables, setTables] = useState([]);
  const [table, setTable] = useState(null);
  const [bet, setBet] = useState(10);
  const [side, setSide] = useState('player');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      setBet(Number(data.min_bet) || 10);
    }).catch(() => navigate('/'));
  }, [slug, navigate]);

  useEffect(() => {
    if (!user?.id) return;
    const s = getSocket();
    socketRef.current = s;

    const onState = (state) => {
      const oldTable = table;
      setTable(state);
      setView('table');
      
      // Check for win
      if (state?.phase === 'results' && oldTable?.phase !== 'results') {
        const mySeat = state.seats?.find(s => String(s.userId) === String(user.id));
        if (mySeat?.lastPayout > 0) {
          const winRatio = mySeat.bet > 0 ? mySeat.lastPayout / mySeat.bet : 0;
          setLastWin({ amount: mySeat.lastPayout, bet: mySeat.bet, result: mySeat.result });
          
          // Play appropriate win sound
          if (winRatio >= 10) {
            playSound('bigwin');
          } else if (winRatio >= 5) {
            playSound('bigwin');
          } else if (winRatio >= 2) {
            playSound('win');
          } else {
            playSound('win');
          }
          
          if (mySeat.result === 'blackjack') {
            playSound('blackjack');
          }
          
          // Auto-clear win display after 5 seconds
          setTimeout(() => setLastWin(null), 5000);
        } else if (mySeat?.result === 'lose') {
          playSound('lose');
        } else if (mySeat?.result === 'push') {
          playSound('push');
        }
      } else {
        playSound('deal');
      }
    };
    
    const onWallet = (payload) => {
      if (payload?.balance != null) setBalance(Number(payload.balance));
    };

    s.on('card:state', onState);
    s.on('wallet:update', onWallet);

    return () => {
      s.emit('card:leave');
      s.off('card:state', onState);
      s.off('wallet:update', onWallet);
    };
  }, [user?.id, playSound]);

  const refreshTables = useCallback(() => {
    if (!game?.id || !socketRef.current) return;
    socketRef.current.emit('card:list', { gameId: game.id }, (res) => {
      if (res?.ok) setTables(res.tables || []);
    });
  }, [game?.id]);

  useEffect(() => {
    if (view === 'lobby' && game?.id) {
      refreshTables();
      const t = setInterval(refreshTables, 4000);
      return () => clearInterval(t);
    }
  }, [view, game?.id, refreshTables]);

  const emit = (event, payload) =>
    new Promise((resolve) => {
      const s = socketRef.current;
      if (!s) return resolve({ ok: false, error: 'Not connected' });
      s.emit(event, payload, (res) => resolve(res || { ok: false, error: 'No response' }));
    });

  const createTable = async () => {
    if (!user || !game) return;
    setBusy(true); setError('');
    playSound('click');
    const res = await emit('card:create', {
      gameId: game.id,
      userId: user.id,
      username: user.username,
    });
    setBusy(false);
    if (!res.ok) setError(res.error || 'Create failed');
    else if (res.table) { setTable(res.table); setView('table'); }
  };

  const joinTable = async (tableId) => {
    if (!user) return;
    setBusy(true); setError('');
    playSound('click');
    const res = await emit('card:join', {
      tableId,
      userId: user.id,
      username: user.username,
    });
    setBusy(false);
    if (!res.ok) setError(res.error || 'Join failed');
    else if (res.table) { setTable(res.table); setView('table'); }
  };

  const leaveTable = () => {
    socketRef.current?.emit('card:leave');
    setTable(null);
    setView('lobby');
    refreshTables();
    playSound('click');
  };

  const placeBet = async () => {
    if (!table || !user) return;
    setBusy(true); setError('');
    playSound('chips');
    const res = await emit('card:bet', {
      tableId: table.id,
      userId: user.id,
      amount: bet,
      side: table.mode === 'blackjack' ? null : side,
    });
    setBusy(false);
    if (!res.ok) setError(res.error || 'Bet failed');
    else {
      if (res.balance != null) setBalance(Number(res.balance));
      if (res.table) setTable(res.table);
      setMsg(`Bet ₱${bet} placed`);
      walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    }
  };

  const hit = async () => {
    setBusy(true);
    playSound('deal');
    const res = await emit('card:hit', { tableId: table.id, userId: user.id });
    setBusy(false);
    if (!res.ok) setError(res.error || 'Hit failed');
    else if (res.table) setTable(res.table);
  };

  const stand = async () => {
    setBusy(true);
    playSound('click');
    const res = await emit('card:stand', { tableId: table.id, userId: user.id });
    setBusy(false);
    if (!res.ok) setError(res.error || 'Stand failed');
    else if (res.table) setTable(res.table);
  };

  if (!game || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a1628', color: '#8ab' }}>
        Loading table…
      </div>
    );
  }

  const mySeat = table?.seats?.find(s => String(s.userId) === String(user.id));
  const isMyTurn = table && String(table.currentTurnUserId) === String(user.id);
  const canBet = table && (table.phase === 'betting' || table.phase === 'waiting');
  const sideOptions =
    table?.mode === 'baccarat' ? ['player', 'banker', 'tie'] :
    table?.mode === 'dragon_tiger' ? ['dragon', 'tiger', 'tie'] :
    table?.mode === 'andar_bahar' ? ['andar', 'bahar'] : [];

  // ── LOBBY ────────────────────────────────────────────────────────────────
  if (view === 'lobby') {
    return (
      <div style={{
        minHeight: '100vh', maxWidth: 480, margin: '0 auto',
        background: 'linear-gradient(180deg, #0a1628, #12243a)', color: '#e8f0ff',
        fontFamily: 'system-ui, sans-serif', padding: '0 0 24px',
      }}>
        <style>{`
          @keyframes cardFlip { 0% { transform: rotateY(0); } 50% { transform: rotateY(90deg); } 100% { transform: rotateY(0); } }
        `}</style>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid #1e3a5f',
        }}>
          <Link to="/" style={{ color: '#7ec8ff', textDecoration: 'none', fontWeight: 700 }}>← Lobby</Link>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, color: '#FFD700' }}>{game.name}</div>
            <div style={{ fontSize: 11, color: '#6a9' }}>MULTIPLAYER · REAL MONEY</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#6a9' }}>BALANCE</div>
            <div style={{ fontWeight: 800, color: '#FFD700' }}>₱{balance.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <p style={{ fontSize: 13, color: '#8ab', marginBottom: 16, lineHeight: 1.5 }}>
            Join a live table. Bets debit your wallet immediately. Wins credit automatically when the hand settles.
          </p>

          <button type="button" onClick={createTable} disabled={busy || balance < (game.min_bet || 10)}
            style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none', marginBottom: 16,
              background: 'linear-gradient(135deg, #FFD700, #f0a500)', color: '#1a1200',
              fontWeight: 900, fontSize: 15, cursor: busy ? 'wait' : 'pointer',
            }}>
            + Create Table
          </button>

          {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <div style={{ fontSize: 12, color: '#6a9', marginBottom: 8, fontWeight: 700 }}>OPEN TABLES</div>
          {tables.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#567', background: 'rgba(0,0,0,0.2)', borderRadius: 12 }}>
              No open tables — create one to start
            </div>
          )}
          {tables.map(t => (
            <div key={t.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 14px', marginBottom: 8, borderRadius: 12,
              background: 'rgba(0,40,70,0.5)', border: '1px solid #1e4a6f',
            }}>
              <div>
                <div style={{ fontWeight: 700 }}>{t.playerCount}/{t.maxSeats} players</div>
                <div style={{ fontSize: 11, color: '#6a9' }}>
                  {t.phase} · ₱{t.minBet}–₱{t.maxBet} · {t.mode}
                </div>
              </div>
              <button type="button" onClick={() => joinTable(t.id)} disabled={busy || t.playerCount >= t.maxSeats}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: '#1abc9c', color: '#fff', fontWeight: 700, cursor: 'pointer',
                }}>
                Join
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── TABLE (BET365 STYLE) ──────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', maxWidth: 480, margin: '0 auto',
      background: 'linear-gradient(180deg, #0b4d2a 0%, #0a3d22 50%, #051f12 100%)',
      color: '#e8ffe8', fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes cardFlip { 0% { transform: rotateY(0); } 50% { transform: rotateY(90deg); } 100% { transform: rotateY(0); } }
        @keyframes chipPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        @keyframes winCardGlow { 0%, 100% { box-shadow: 0 0 10px rgba(255,215,0,0.5), 0 4px 12px rgba(0,0,0,0.5); } 50% { box-shadow: 0 0 25px rgba(255,215,0,0.9), 0 4px 12px rgba(0,0,0,0.5); } }
        @keyframes goldPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.7; } }
        @keyframes winPulse { 0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(255,215,0,0.5); } 50% { transform: scale(1.05); box-shadow: 0 6px 30px rgba(255,215,0,0.8); } }
        @keyframes mediumWin { 0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(255,215,0,0.6); } 50% { transform: scale(1.06); box-shadow: 0 8px 35px rgba(255,215,0,0.9); } }
        @keyframes bigWin { 0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(255,215,0,0.7); } 50% { transform: scale(1.08); box-shadow: 0 10px 40px rgba(255,215,0,1); } }
        @keyframes megaWin { 0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(255,215,0,0.8); } 50% { transform: scale(1.1); box-shadow: 0 12px 45px rgba(255,215,0,1), 0 0 30px rgba(255,107,0,0.6); } }
        @keyframes blackjackWin { 0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(255,215,0,0.7), 0 0 20px rgba(0,255,0,0.3); } 50% { transform: scale(1.07); box-shadow: 0 8px 35px rgba(255,215,0,0.9), 0 0 30px rgba(0,255,0,0.5); } }
        @keyframes shine { 0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); } 100% { transform: translateX(100%) translateY(100%) rotate(45deg); } }
        @keyframes confettiFall { 0% { transform: translateY(-100px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', background: 'rgba(0,0,0,0.45)', borderBottom: '2px solid #1a4a2a',
      }}>
        <button type="button" onClick={leaveTable} style={{ background: 'none', border: 'none', color: '#7ec8ff', fontWeight: 700, cursor: 'pointer' }}>
          ← Leave
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, color: '#FFD700', fontSize: 13 }}>{table?.gameName || game.name}</div>
          <div style={{ fontSize: 10, color: '#6a9' }}>
            {table?.phase?.toUpperCase()} · {table?.seats?.length || 0} players
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#6a9' }}>BALANCE</div>
          <div style={{ fontWeight: 800, color: '#FFD700' }}>₱{Number(balance).toLocaleString()}</div>
        </div>
      </div>

      {/* Felt Table */}
      <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Win Display */}
        {lastWin && (
          <WinDisplay amount={lastWin.amount} betAmount={lastWin.bet} resultType={lastWin.result} />
        )}

        {/* Dealer Hand */}
        <div style={{
          background: 'rgba(0,0,0,0.25)', borderRadius: 14, padding: 12, marginBottom: 12,
          border: '2px solid rgba(255,215,0,0.2)',
        }}>
          <Hand
            label="DEALER"
            cards={table?.dealerHand}
            value={table?.phase === 'playing' ? table?.dealerValue : (table?.dealerHand?.length ? undefined : null)}
          />
        </div>

        {/* Message */}
        <div style={{
          textAlign: 'center', padding: '10px 12px', marginBottom: 12, borderRadius: 10,
          background: 'rgba(255,215,0,0.1)', color: '#FFD700', fontWeight: 700, fontSize: 13,
          border: '1px solid rgba(255,215,0,0.3)',
        }}>
          {table?.message || msg || '…'}
        </div>

        {error && <div style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{error}</div>}

        {/* Player Seats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(table?.seats || []).map(seat => {
            const mine = String(seat.userId) === String(user.id);
            const turn = String(table.currentTurnUserId) === String(seat.userId);
            const isWinner = seat.result === 'win' || seat.result === 'blackjack';
            const isLoser = seat.result === 'lose';
            
            return (
              <div key={seat.userId} style={{
                padding: 10, borderRadius: 12,
                background: turn ? 'rgba(255,215,0,0.15)' : 
                          isWinner ? 'rgba(0,255,0,0.1)' : 
                          isLoser ? 'rgba(255,0,0,0.1)' : 'rgba(0,0,0,0.22)',
                border: mine ? '2px solid #FFD70088' : 
                        isWinner ? '2px solid #00FF0088' : 
                        isLoser ? '2px solid #FF000088' : '1px solid #1a3a28',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {isWinner && <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'linear-gradient(45deg, transparent 30%, rgba(255,215,0,0.1) 50%, transparent 70%)',
                  animation: 'shine 2s linear infinite',
                }} />}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, position: 'relative', zIndex: 1 }}>
                  <span style={{ fontWeight: 800, color: mine ? '#FFD700' : isWinner ? '#00FF00' : isLoser ? '#FF6B6B' : '#cde' }}>
                    {mine ? '👤 YOU' : seat.username}
                    {turn ? ' · TURN' : ''}
                    {isWinner ? ' 🏆' : ''}
                    {isLoser ? ' ❌' : ''}
                  </span>
                  <span style={{ color: isWinner ? '#00FF00' : isLoser ? '#FF6B6B' : '#8a8' }}>
                    ₱{seat.bet || 0}
                    {seat.side ? ` · ${seat.side}` : ''}
                    {seat.result ? ` · ${seat.result}` : ''}
                    {seat.lastPayout > 0 ? ` · +₱${seat.lastPayout}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative', zIndex: 1 }}>
                  {(seat.hand || []).map((c, i) => <Card key={i} card={c} small winHighlight={isWinner} />)}
                  {seat.hand?.length > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 12, color: isWinner ? '#00FF00' : '#ada', fontWeight: 700 }}>
                      {seat.handValue}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div style={{
        padding: '12px 14px 20px', background: 'rgba(0,0,0,0.55)',
        borderTop: '2px solid #1a4a2a',
      }}>
        {canBet && (
          <>
            {sideOptions.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {sideOptions.map(s => (
                  <button key={s} type="button" onClick={() => setSide(s)}
                    style={{
                      padding: '8px 12px', borderRadius: 8, border: side === s ? '2px solid #FFD700' : '1px solid #2a5',
                      background: side === s ? 'rgba(255,215,0,0.15)' : 'rgba(0,40,20,0.5)',
                      color: side === s ? '#FFD700' : '#8c8', fontWeight: 700, textTransform: 'capitalize',
                    }}>{s}</button>
                ))}
              </div>
            )}

            {/* Chip Selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {CHIP_VALUES.map(val => (
                <button key={val} type="button" onClick={() => setBet(val)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: bet === val ? '2px solid #FFD700' : '1px solid #2a5',
                    background: bet === val ? 'rgba(255,215,0,0.2)' : 'rgba(0,40,20,0.4)',
                    color: bet === val ? '#FFD700' : '#8c8', fontWeight: 700, fontSize: 11,
                    animation: bet === val ? 'chipPulse 0.3s ease-out' : 'none',
                  }}>
                  ₱{val}
                </button>
              ))}
            </div>

            {/* Bet Input & Place */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input
                type="number"
                value={bet}
                min={table.minBet}
                max={Math.min(table.maxBet, balance)}
                onChange={e => setBet(Number(e.target.value))}
                style={{
                  flex: 1, padding: 10, borderRadius: 8, border: '1px solid #2a5',
                  background: '#0a1a10', color: '#FFD700', fontWeight: 700,
                }}
              />
              <button type="button" onClick={placeBet} disabled={busy || bet > balance || bet < table.minBet}
                style={{
                  padding: '12px 20px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #FFD700, #e6a800)', color: '#1a1200',
                  fontWeight: 900, cursor: busy ? 'wait' : 'pointer',
                }}>
                {mySeat?.bet ? 'Raise' : 'Bet'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#6a8' }}>
              Min ₱{table.minBet} · Max ₱{table.maxBet}
            </div>
          </>
        )}

        {table?.phase === 'playing' && isMyTurn && mySeat?.status === 'playing' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={hit} disabled={busy}
              style={{
                flex: 1, padding: 14, borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #3498db, #2980b9)', color: '#fff', fontWeight: 900,
              }}>HIT</button>
            <button type="button" onClick={stand} disabled={busy}
              style={{
                flex: 1, padding: 14, borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #e67e22, #d35400)', color: '#fff', fontWeight: 900,
              }}>STAND</button>
          </div>
        )}

        {table?.phase === 'results' && mySeat && !lastWin && (
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16, color: mySeat.lastPayout > 0 ? '#FFD700' : '#aaa' }}>
            {mySeat.result === 'win' || mySeat.result === 'blackjack'
              ? `🎉 You won ₱${mySeat.lastPayout}`
              : mySeat.result === 'push'
                ? `Push — ₱${mySeat.lastPayout} returned`
                : '❌ No win this round'}
          </div>
        )}
      </div>
    </div>
  );
}
