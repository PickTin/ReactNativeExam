import { api } from './apiClient';

// POST /auth/register  body: { first_name, last_name, email, password }
// Expected response: { user: { id, first_name, last_name, email }, token }
export const registerUser = (data) => api.post('/auth/register', data);

// POST /auth/login  body: { email, password }
// Expected response: { user: { id, first_name, last_name, email }, token }
export const loginUser = (data) => api.post('/auth/login', data);
