import { apiClient } from './client';
import type { User } from './auth';

export interface UpdateProfileData {
	email?: string;
}

export interface ChangePasswordData {
	current_password: string;
	new_password: string;
	new_password_confirm: string;
}

export const profileApi = {
	update: (token: string, data: UpdateProfileData) =>
		apiClient.patch<User>('/auth/profile', data, token),

	changePassword: (token: string, data: ChangePasswordData) =>
		apiClient.post<{ detail: string }>('/auth/change-password', data, token)
};