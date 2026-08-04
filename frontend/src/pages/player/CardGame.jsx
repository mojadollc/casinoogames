import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../hooks/useSocket';

const SUITS = {
  hearts: { symbol: '♥', color: '#e74c3c' },
  diamonds: { symbol: '♦', color: '#e74c3c' },
  clubs: { symbol: '♣', color: '#2c3e50' },
  spades: { symbol: '♠', color: '#2c3e50' },
};

const Card = ({ card, faceDown = false, small = false }) => {
  if (!card || faceDown || card.faceDown) {
    return (
      <div style={{
        width: small ? 36 : 52, height: small ? 50 : 72, borderRadius: 6,
        background: 'linear-gradient(135deg, #1a237e, #0d47a1)',
        border: '1px solid #3949ab', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      }} />
    );
  }
  const meta = SUITS[card.suit] || SUITS.spades;
  return (
    <div style={{
      width: small ? 36 : 52, height: small ? 50 : 72, borderRadius: 6,
      background: '#fff', border: '1px solid #ddd',
      boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: 4, color: meta.color, fontWeight: 800, fontSize: small ? 10 : 12,
    }}>
      <div>{card.rank}{meta.symbol}</div>
      <div style={{ textAlign: 'center', fontSize: small ? 14 : 18 }}>{meta.symbol}</div>
      <div style={{ transform: 'rotate(180deg)' }}>{card.rank}{meta.symbol}</div>
    </div>
  );
};

function Hand({ cards, label, value, highlight }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: highlight ? '#FFD700' : '#8ab', marginBottom: 4, fontWeight: 700 }}>
        {label}{value != null ? ` · ${value}` : ''}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {(cards || []).map((c, i) => <Card key={i} card={c} faceDown={c.faceDown} />)}
        {(!cards || !cards.length) && <span style={{ color: '#567', fontSize: 12 }}>—</span>}
      </div>
    </div>
  );
}

export default function CardGame() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socketRef = useRef(null);

  const [game, setGame] = useState(null);
  const [balance, setBalance] = useState(0);
  const [view, setView] = useState('lobby'); // lobby | table
  const [tables, setTables] = useState([]);
  const [table, setTable] = useState(null);
  const [bet, setBet] = useState(10);
  const [side, setSide] = useState('player');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Load game + balance
  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      setBet(Number(data.min_bet) || 10);
    }).catch(() => navigate('/'));
  }, [slug, navigate]);

  // Socket
  useEffect(() => {
    if (!user?.id) return;
    const s = getSocket();
    socketRef.current = s;

    const onState = (state) => {
      setTable(state);
      setView('table');
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
  }, [user?.id]);

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
  };

  const placeBet = async () => {
    if (!table || !user) return;
    setBusy(true); setError('');
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
      // Refresh balance from API for accuracy
      walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    }
  };

  const hit = async () => {
    setBusy(true);
    const res = await emit('card:hit', { tableId: table.id, userId: user.id });
    setBusy(false);
    if (!res.ok) setError(res.error || 'Hit failed');
    else if (res.table) setTable(res.table);
  };

  const stand = async () => {
    setBusy(true);
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

  // ── TABLE ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', maxWidth: 480, margin: '0 auto',
      background: 'linear-gradient(180deg, #0b1f14 0%, #0a2818 40%, #0d1a12 100%)',
      color: '#e8ffe8', fontFamily: 'system-ui, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', background: 'rgba(0,0,0,0.45)', borderBottom: '1px solid #1a4a2a',
      }}>
        <button type="button" onClick={leaveTable} style={{ background: 'none', border: 'none', color: '#7ec8ff', fontWeight: 700, cursor: 'pointer' }}>
          ← Leave
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 800, color: '#FFD700', fontSize: 13 }}>{table?.gameName || game.name}</div>
          <div style={{ fontSize: 10, color: '#6a9' }}>
            {table?.phase?.toUpperCase()} · {table?.seats?.length || 0} players · LIVE
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#6a9' }}>BALANCE</div>
          <div style={{ fontWeight: 800, color: '#FFD700' }}>₱{Number(balance).toLocaleString()}</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: 14 }}>
        {/* Dealer */}
        <div style={{
          background: 'rgba(0,0,0,0.25)', borderRadius: 14, padding: 12, marginBottom: 12,
          border: '1px solid rgba(255,215,0,0.15)',
        }}>
          <Hand
            label="Dealer"
            cards={table?.dealerHand}
            value={table?.phase === 'playing' ? table?.dealerValue : (table?.dealerHand?.length ? undefined : null)}
          />
          {table?.phase !== 'playing' && table?.dealerHand?.length > 0 && (
            <div style={{ fontSize: 12, color: '#ada' }}>
              {/* value shown after reveal via seat logic */}
            </div>
          )}
        </div>

        {/* Message */}
        <div style={{
          textAlign: 'center', padding: '8px 10px', marginBottom: 12, borderRadius: 10,
          background: 'rgba(255,215,0,0.08)', color: '#FFD700', fontWeight: 700, fontSize: 13,
        }}>
          {table?.message || msg || '…'}
        </div>

        {error && <div style={{ color: '#ff6b6b', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{error}</div>}

        {/* Seats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(table?.seats || []).map(seat => {
            const mine = String(seat.userId) === String(user.id);
            const turn = String(table.currentTurnUserId) === String(seat.userId);
            return (
              <div key={seat.userId} style={{
                padding: 10, borderRadius: 12,
                background: turn ? 'rgba(255,215,0,0.12)' : 'rgba(0,0,0,0.22)',
                border: mine ? '1px solid #FFD70066' : '1px solid #1a3a28',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                  <span style={{ fontWeight: 800, color: mine ? '#FFD700' : '#cde' }}>
                    {mine ? 'You' : seat.username}
                    {turn ? ' · TURN' : ''}
                  </span>
                  <span style={{ color: '#8a8' }}>
                    Bet ₱{seat.bet || 0}
                    {seat.side ? ` · ${seat.side}` : ''}
                    {seat.result ? ` · ${seat.result}` : ''}
                    {seat.lastPayout > 0 ? ` · +₱${seat.lastPayout}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {(seat.hand || []).map((c, i) => <Card key={i} card={c} small />)}
                  {seat.hand?.length > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 12, color: '#ada', fontWeight: 700 }}>
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
        borderTop: '1px solid #1a4a2a',
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
                {mySeat?.bet ? 'Raise Bet' : 'Place Bet'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#6a8' }}>
              Min ₱{table.minBet} · Max ₱{table.maxBet} · Balance ₱{balance.toLocaleString()}
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

        {table?.phase === 'results' && mySeat && (
          <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16, color: mySeat.lastPayout > 0 ? '#FFD700' : '#aaa' }}>
            {mySeat.result === 'win' || mySeat.result === 'blackjack'
              ? `You won ₱${mySeat.lastPayout}`
              : mySeat.result === 'push'
                ? `Push — ₱${mySeat.lastPayout} returned`
                : 'No win this round'}
          </div>
        )}
      </div>
    </div>
  );
}
