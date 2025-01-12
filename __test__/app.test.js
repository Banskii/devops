// app.test.js

const request = require('supertest');
const app = require('../index');  // Assuming index.js is where you export the app

describe('GET /', () => {
  it('should return status 200', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
  });
});
