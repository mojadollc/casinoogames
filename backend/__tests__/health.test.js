const request = require('supertest');

// Minimal server bootstrap for testing (no Redis/DB required)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.ADMIN_URL = 'http://localhost:3000/admin';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok' }));

describe('Health Check', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
