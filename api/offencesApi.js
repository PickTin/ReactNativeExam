import { api } from './apiClient';

// Contract expected from the backend (not implemented yet):
//   GET    /offences/dates                      -> { dates: ['YYYY-MM-DD', ...] }
//   GET    /offences/locations                  -> { locations: [{ id, latitude, longitude }] }
//   GET    /offences                            -> { offences: [...] }  (all non-deleted records)
//   GET    /offences?date=YYYY-MM-DD            -> { offences: [...] }
//   GET    /offences?lat=..&lng=..&radius=..    -> { offences: [...] }  (radius in km)
//   POST   /offences                            -> { id, url, created_at, updated_at }
//          Idempotent by client_uuid: repeating the request returns the same record.
//   PUT    /offences/:id                        -> { id, ... }
//   DELETE /offences/:id                        -> 204
// Offence body fields: client_uuid, description, date, time, latitude, longitude, created_at, url.

export const fetchRemoteOffences = () => api.get('/offences');

export const fetchRemoteOffenceDates = () => api.get('/offences/dates');

export const fetchRemoteLocations = () => api.get('/offences/locations');

export const fetchRemoteOffencesByDate = (date) => api.get('/offences', { query: { date } });

export const fetchRemoteOffencesNear = ({ latitude, longitude, radiusKm }) =>
    api.get('/offences', { query: { lat: latitude, lng: longitude, radius: radiusKm } });

export const createRemoteOffence = (payload) => api.post('/offences', payload);

export const updateRemoteOffence = (serverId, payload) => api.put(`/offences/${serverId}`, payload);

export const deleteRemoteOffence = (serverId) => api.delete(`/offences/${serverId}`);
