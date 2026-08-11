import { apiClient } from './client';

export interface TokenPair {
	access: string;
	refresh: string;
}

export type Role = 'archer' | 'judge' | 'admin';

export interface User {
	id: string;
	username: string;
	email: string;
	role: Role;
}

export const authApi = {
	login: (username: string, password: string) =>
		apiClient.post<TokenPair>('/token/pair', { username, password }),

	refresh: (refreshToken: string) =>
		apiClient.post<Pick<TokenPair, 'access'>>('/token/refresh', { refresh: refreshToken }),

	register: (email: string, password: string, password_confirm: string) =>
		apiClient.post<User>('/auth/register', { email, password, password_confirm }),

	me: (token: string) => apiClient.get<User>('/auth/me', token)
};
