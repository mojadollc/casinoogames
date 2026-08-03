import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gameAPI, walletAPI } from '../../services/api';

// Card suit symbols
const SUITS = {
  hearts: { symbol: '♥', color: '#ff2d75' },
  diamonds: { symbol: '♦', color: '#ff2d75' },
  clubs: { symbol: '♣', color: '#1a1a2e' },
  spades: { symbol: '♠', color: '#1a1a2e' }
};

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Generate a random card
const randomCard = () => {
  const suit = Object.keys(SUITS)[Math.floor(Math.random() * 4)];
  const rank = RANKS[Math.floor(Math.random() * 13)];
  return { suit, rank, ...SUITS[suit] };
};

// Playing Card Component
const Card = ({ card, faceDown = false, dealing = false, winning = false }) => {
  if (faceDown) {
    return (
      <div style={{
        width: '80px',
        height: '112px',
        background: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #1a0a2e 100%)',
        borderRadius: '10px',
        border: '2px solid #ffd700',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          inset: '4px',
          background: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255, 215, 0, 0.1) 5px, rgba(255, 215, 0, 0.1) 10px)',
          borderRadius: '6px'
        }} />
        <span style={{ fontSize: '28px', zIndex: 1 }}>🐉</span>
      </div>
    );
  }

  return (
    <div style={{
      width: '80px',
      height: '112px',
      background: 'linear-gradient(145deg, #ffffff 0%, #f0f0f0 100%)',
      borderRadius: '10px',
      border: winning ? '3px solid #ffd700' : '2px solid rgba(255, 215, 0, 0.3)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '6px',
      boxShadow: winning 
        ? '0 0 30px rgba(255, 215, 0, 0.8)' 
        : '0 4px 15px rgba(0, 0, 0, 0.3)',
      position: 'relative',
      animation: dealing ? 'dealCard 0.3s ease-out' : 'none',
      transform: winning ? 'scale(1.05)' : 'scale(1)',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <span style={{ fontSize: '18px', fontWeight: '900', color: card.color }}>{card.rank}</span>
        <span style={{ fontSize: '16px', color: card.color }}>{card.symbol}</span>
      </div>
      <div style={{ 
        fontSize: '36px', 
        textAlign: 'center', 
        color: card.color,
        textShadow: card.color === '#ff2d75' ? '0 0 10px rgba(255, 45, 117, 0.3)' : 'none'
      }}>
        {card.symbol}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', transform: 'rotate(180deg)' }}>
        <span style={{ fontSize: '18px', fontWeight: '900', color: card.color }}>{card.rank}</span>
        <span style={{ fontSize: '16px', color: card.color }}>{card.symbol}</span>
      </div>
    </div>
  );
};

// Games that support HIT/STAND (blackjack-style)
const BLACKJACK_SLUGS = ['blackjack-vip', 'texas-holdem', 'teen-patti', 'andar-bahar'];

export default function CardGame() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [game, setGame] = useState(null);
  const [bet, setBet] = useState(10);
  const [balance, setBalance] = useState(0);
  const [dealing, setDealing] = useState(false);
  const [playerCards, setPlayerCards] = useState([]);
  const [dealerCards, setDealerCards] = useState([]);
  const [gameState, setGameState] = useState('betting'); // betting, playing, result
  const [result, setResult] = useState(null);
  const [lastWin, setLastWin] = useState(0);
  const [message, setMessage] = useState('');
  // Track backend-decided outcome so HIT/STAND resolve correctly
  const backendOutcomeRef = React.useRef(null);

  const isBlackjack = BLACKJACK_SLUGS.some(s => slug?.toLowerCase().includes(s));

  useEffect(() => {
    walletAPI.balance().then(({ data }) => setBalance(Number(data.balance) || 0)).catch(() => {});
    gameAPI.details(slug).then(({ data }) => {
      setGame(data);
      setBet(Number(data.min_bet));
    }).catch(() => navigate('/'));
  }, [slug, navigate]);

  const calculateHandValue = (cards) => {
    let value = 0;
    let aces = 0;
    
    cards.forEach(card => {
      if (card.rank === 'A') {
        aces++;
        value += 11;
      } else if (['K', 'Q', 'J'].includes(card.rank)) {
        value += 10;
      } else {
        value += parseInt(card.rank);
      }
    });
    
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }
    
    return value;
  };

  const enrichCard = (c) => {
    if (!c) return randomCard();
    const suit = c.suit || Object.keys(SUITS)[Math.floor(Math.random() * 4)];
    const rank = c.rank || RANKS[Math.floor(Math.random() * 13)];
    return { suit, rank, ...SUITS[suit] };
  };

  const deal = async () => {
    if (dealing || balance < bet) return;
    setDealing(true);
    setResult(null);
    setMessage('');
    setLastWin(0);
    setPlayerCards([]);
    setDealerCards([]);
    backendOutcomeRef.current = null;

    try {
      // Server-authoritative outcome (win_rate / force_outcome / payout caps)
      const { data } = await gameAPI.play(game.id, { betAmount: bet });
      setBalance(data.balance);
      backendOutcomeRef.current = data;

      const won = data.totalWin > 0 && data.outcome !== 'push';
      const isPush = data.outcome === 'push';

      // Prefer server hands when provided; otherwise align visuals to outcome
      let newPlayerCards = Array.isArray(data.playerHand) && data.playerHand.length >= 2
        ? data.playerHand.map(enrichCard)
        : [randomCard(), randomCard()];
      let newDealerCards = Array.isArray(data.dealerHand) && data.dealerHand.length >= 2
        ? data.dealerHand.map(enrichCard)
        : [randomCard(), randomCard()];

      if (!data.playerHand) {
        if (won) {
          newPlayerCards[1] = getCardForValue(newPlayerCards[0], 19 + Math.floor(Math.random() * 3));
          newDealerCards[1] = getCardForValue(newDealerCards[0], 14 + Math.floor(Math.random() * 5));
        } else if (!isPush) {
          newPlayerCards[1] = getCardForValue(newPlayerCards[0], 14 + Math.floor(Math.random() * 4));
          newDealerCards[1] = getCardForValue(newDealerCards[0], 18 + Math.floor(Math.random() * 3));
        }
      }

      // Animate deal sequence
      await new Promise(r => setTimeout(r, 200));
      setPlayerCards([newPlayerCards[0]]);
      await new Promise(r => setTimeout(r, 300));
      setPlayerCards([...newPlayerCards]);
      await new Promise(r => setTimeout(r, 300));
      setDealerCards([{ ...newDealerCards[0], faceDown: false }]);
      await new Promise(r => setTimeout(r, 300));
      setDealerCards([{ ...newDealerCards[0], faceDown: false }, { ...newDealerCards[1], faceDown: true }]);

      if (isBlackjack) {
        // HIT / STAND UI — final message still follows backendOutcomeRef
        setDealing(false);
        setGameState('playing');
      } else {
        await new Promise(r => setTimeout(r, 600));
        setDealerCards(newDealerCards.map(c => ({ ...c, faceDown: false })));
        setDealing(false);
        setGameState('result');
        if (isPush) {
          setResult('push');
          setLastWin(data.totalWin || 0);
          setMessage("🤝 PUSH — It's a tie!");
        } else if (won) {
          setResult(data.outcome === 'blackjack' ? 'blackjack' : 'win');
          setLastWin(data.totalWin);
          setMessage(`🎉 You WIN! ₱${data.totalWin.toLocaleString()}`);
        } else {
          setResult('lose');
          setMessage('😔 Dealer wins.');
        }
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Deal failed');
      setDealing(false);
      setGameState('betting');
    }
  };

  // Helper: get a card that contributes to a target hand value
  const getCardForValue = (existingCard, targetTotal) => {
    const existingVal = existingCard.rank === 'A' ? 11 : ['K','Q','J'].includes(existingCard.rank) ? 10 : parseInt(existingCard.rank);
    const needed = targetTotal - existingVal;
    const clampedNeeded = Math.max(2, Math.min(10, needed));
    const rank = clampedNeeded === 10 ? ['10','J','Q','K'][Math.floor(Math.random() * 4)] : String(clampedNeeded);
    const suit = Object.keys(SUITS)[Math.floor(Math.random() * 4)];
    return { suit, rank, ...SUITS[suit] };
  };

  const hit = (currentCards) => {
    const newCard = randomCard();
    const newCards = [...currentCards, newCard];
    setPlayerCards(newCards);
    const value = calculateHandValue(newCards);
    if (value > 21) {
      setMessage('💥 BUST! You lose.');
      setResult('lose');
      setGameState('result');
      setDealerCards(prev => prev.map(c => ({ ...c, faceDown: false })));
    } else if (value === 21) {
      stand(newCards);
    }
    return newCards;
  };

  const stand = async (currentCards) => {
    // currentCards passed explicitly to avoid stale closure from playerCards state
    const finalPlayerCards = currentCards || playerCards;
    setGameState('result');
    const revealedDealer = dealerCards.map(c => ({ ...c, faceDown: false }));
    setDealerCards(revealedDealer);
    let dealerHand = [...revealedDealer];
    await new Promise(r => setTimeout(r, 500));
    while (calculateHandValue(dealerHand) < 17) {
      await new Promise(r => setTimeout(r, 500));
      dealerHand = [...dealerHand, randomCard()];
      setDealerCards([...dealerHand]);
    }
    const playerValue = calculateHandValue(finalPlayerCards);
    const dealerValue = calculateHandValue(dealerHand);
    const backendWon = backendOutcomeRef.current?.totalWin > 0;
    await new Promise(r => setTimeout(r, 300));
    // Visual result must agree with backend outcome to keep wallet consistent
    if (backendWon) {
      const winAmt = backendOutcomeRef.current.totalWin;
      setLastWin(winAmt);
      if (dealerValue > 21) {
        setMessage(`🎉 Dealer BUSTS! You WIN! ₱${winAmt.toLocaleString()}`);
      } else {
        setMessage(`🎉 You WIN! ₱${winAmt.toLocaleString()}`);
      }
      setResult('win');
    } else {
      if (playerValue === dealerValue) {
        setMessage("🤝 PUSH — It's a tie!");
        setResult('push');
      } else {
        setMessage('😔 Dealer wins.');
        setResult('lose');
      }
    }
  };

  const newRound = () => {
    setGameState('betting');
    setPlayerCards([]);
    setDealerCards([]);
    setResult(null);
    setMessage('');
    setLastWin(0);
  };

  if (!game) return <div className="loading"><div className="spinner" /></div>;

  const playerValue = calculateHandValue(playerCards);
  const dealerValue = calculateHandValue(dealerCards.filter(c => !c.faceDown));

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0015 0%, #1a0a2e 30%, #0a0015 70%, #050010 100%)',
      padding: '20px 16px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '14px 18px',
        background: 'linear-gradient(145deg, rgba(255, 215, 0, 0.1), rgba(255, 215, 0, 0.05))',
        borderRadius: '20px',
        border: '2px solid',
        borderImage: 'linear-gradient(135deg, #ffd700, #ffed4a, #ffd700) 1'
      }}>
        <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center',
            background: 'linear-gradient(145deg, #ffd700, #b8860b)',
            borderRadius: '12px',
            padding: '10px 18px',
            color: '#1a0a2e',
            fontWeight: '800',
            fontSize: '13px',
            textDecoration: 'none'
          }}
        >
          ← Home
        </Link>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: 'var(--gold)', opacity: 0.8 }}>Balance</div>
          <div style={{
            fontSize: '20px',
            fontWeight: '900',
            background: 'linear-gradient(135deg, #ffd700, #ffed4a)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            ₱{Number(balance).toLocaleString('en', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Game Title */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{
          fontSize: '28px',
          background: 'linear-gradient(135deg, #ffd700 0%, #ffed4a 50%, #ffd700 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: '900',
          letterSpacing: '2px'
        }}>
          🃏 {game.name}
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '8px' }}>
          <span style={{
            padding: '6px 14px',
            background: 'rgba(255, 215, 0, 0.15)',
            borderRadius: '20px',
            fontSize: '12px',
            color: 'var(--gold)'
          }}>
            RTP {game.rtp}%
          </span>
          <span style={{
            padding: '6px 14px',
            background: 'rgba(255, 45, 117, 0.15)',
            borderRadius: '20px',
            fontSize: '12px',
            color: 'var(--primary)'
          }}>
            ₱{game.min_bet} - ₱{game.max_bet}
          </span>
        </div>
      </div>

      {/* Card Table */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(145deg, rgba(0, 100, 50, 0.3), rgba(0, 50, 25, 0.4))',
        borderRadius: '24px',
        border: '4px solid rgba(139, 90, 43, 0.5)',
        padding: '24px',
        position: 'relative',
        marginBottom: '20px'
      }}>
        {/* Dealer Section */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            Dealer {dealerCards.length > 0 && `(${dealerValue})`}
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            minHeight: '112px'
          }}>
            {dealerCards.map((card, i) => (
              <Card key={i} card={card} faceDown={card.faceDown} dealing={true} />
            ))}
          </div>
        </div>

        {/* Center Divider */}
        <div style={{
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.5), transparent)',
          margin: '20px 0'
        }} />

        {/* Player Section */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            minHeight: '112px',
            marginBottom: '12px'
          }}>
            {playerCards.map((card, i) => (
              <Card key={i} card={card} dealing={true} winning={result === 'win' || result === 'blackjack'} />
            ))}
          </div>
          <div style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.7)',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            Your Hand {playerCards.length > 0 && `(${playerValue})`}
          </div>
        </div>

        {/* Table decoration */}
        <div style={{
          position: 'absolute',
          top: '10px',
          fontSize: '40px',
          opacity: '0.1'
        }}>🃏</div>
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          fontSize: '40px',
          opacity: '0.1'
        }}>♠️</div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
          padding: '16px',
          background: result === 'win' || result === 'blackjack' 
            ? 'rgba(0, 245, 160, 0.2)' 
            : result === 'lose' 
              ? 'rgba(255, 71, 87, 0.2)' 
              : 'rgba(255, 215, 0, 0.2)',
          borderRadius: '16px',
          border: `2px solid ${result === 'win' || result === 'blackjack' ? '#00f5a0' : result === 'lose' ? '#ff4757' : '#ffd700'}`
        }}>
          <span style={{
            fontSize: '20px',
            fontWeight: '900',
            color: result === 'win' || result === 'blackjack' ? '#00f5a0' : result === 'lose' ? '#ff4757' : '#ffd700'
          }}>
            {message}
          </span>
          {lastWin > 0 && (
            <div style={{
              marginTop: '8px',
              fontSize: '24px',
              fontWeight: '900',
              color: '#ffd700'
            }}>
              +₱{lastWin}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      {gameState === 'betting' && (
        <div style={{ textAlign: 'center' }}>
          {/* Bet Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            marginBottom: '20px',
            padding: '16px',
            background: 'linear-gradient(145deg, rgba(255, 215, 0, 0.1), rgba(255, 215, 0, 0.05))',
            borderRadius: '20px',
            border: '1px solid rgba(255, 215, 0, 0.3)'
          }}>
            <button
              onClick={() => setBet(Math.max(Number(game.min_bet), bet - Number(game.min_bet)))}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #ffd700, #b8860b)',
                border: 'none',
                color: '#1a0a2e',
                fontSize: '24px',
                fontWeight: '900',
                cursor: 'pointer'
              }}
            >−</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255, 215, 0, 0.7)' }}>BET</div>
              <div style={{ fontSize: '28px', fontWeight: '900', color: '#ffd700' }}>₱{bet}</div>
            </div>
            <button
              onClick={() => setBet(Math.min(Number(game.max_bet), bet + Number(game.min_bet)))}
              disabled={bet + Number(game.min_bet) > balance}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #ffd700, #b8860b)',
                border: 'none',
                color: '#1a0a2e',
                fontSize: '24px',
                fontWeight: '900',
                cursor: bet + Number(game.min_bet) > balance ? 'not-allowed' : 'pointer',
                opacity: bet + Number(game.min_bet) > balance ? 0.4 : 1
              }}
            >+</button>
          </div>

          {/* Low / Zero Balance Warning */}
          {balance <= 0 && (
            <div style={{
              marginBottom: '16px',
              padding: '14px 20px',
              background: 'rgba(255, 71, 87, 0.15)',
              border: '2px solid #ff4757',
              borderRadius: '16px',
              textAlign: 'center',
              color: '#ff4757',
              fontWeight: '700',
              fontSize: '14px'
            }}>
              💸 No balance! Please <span
                onClick={() => navigate('/wallet')}
                style={{ textDecoration: 'underline', cursor: 'pointer', color: '#ffd700' }}
              >deposit funds</span> to play.
            </div>
          )}
          {balance > 0 && balance < bet && (
            <div style={{
              marginBottom: '16px',
              padding: '14px 20px',
              background: 'rgba(254, 228, 64, 0.1)',
              border: '2px solid #fee440',
              borderRadius: '16px',
              textAlign: 'center',
              color: '#fee440',
              fontWeight: '700',
              fontSize: '14px'
            }}>
              ⚠️ Insufficient balance. Lower your bet or <span
                onClick={() => navigate('/wallet')}
                style={{ textDecoration: 'underline', cursor: 'pointer', color: '#ffd700' }}
              >deposit more</span>.
            </div>
          )}

          {/* Deal Button */}
          <button
            onClick={deal}
            disabled={dealing || balance < bet || balance <= 0}
            style={{
              padding: '20px 60px',
              background: (balance < bet || balance <= 0)
                ? 'linear-gradient(135deg, #333, #222)'
                : 'linear-gradient(135deg, #ffd700, #ffed4a)',
              border: 'none',
              borderRadius: '30px',
              color: (balance < bet || balance <= 0) ? '#666' : '#1a0a2e',
              fontSize: '20px',
              fontWeight: '900',
              cursor: (balance < bet || balance <= 0) ? 'not-allowed' : 'pointer',
              boxShadow: (balance < bet || balance <= 0) ? 'none' : '0 0 40px rgba(255, 215, 0, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '3px'
            }}
          >
            🃏 DEAL
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '20px'
        }}>
          <button
            onClick={() => hit(playerCards)}
            disabled={dealing}
            style={{
              padding: '18px 40px',
              background: 'linear-gradient(145deg, #00f5d4, #00d4aa)',
              border: 'none',
              borderRadius: '20px',
              color: '#0d0221',
              fontSize: '18px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 0 30px rgba(0, 245, 212, 0.5)'
            }}
          >
            HIT
          </button>
          <button
            onClick={() => stand(playerCards)}
            disabled={dealing}
            style={{
              padding: '18px 40px',
              background: 'linear-gradient(145deg, #ff2d75, #ff6b9d)',
              border: 'none',
              borderRadius: '20px',
              color: 'white',
              fontSize: '18px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 0 30px rgba(255, 45, 117, 0.5)'
            }}
          >
            STAND
          </button>
        </div>
      )}

      {gameState === 'result' && (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={newRound}
            style={{
              padding: '18px 50px',
              background: 'linear-gradient(145deg, #ffd700, #b8860b)',
              border: 'none',
              borderRadius: '20px',
              color: '#1a0a2e',
              fontSize: '18px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 0 30px rgba(255, 215, 0, 0.5)'
            }}
          >
            NEW ROUND
          </button>
        </div>
      )}

      <style>{`
        @keyframes dealCard {
          from { transform: translateY(-50px) rotateY(90deg); opacity: 0; }
          to { transform: translateY(0) rotateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
