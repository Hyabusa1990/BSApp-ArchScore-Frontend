import { apiClient } from './client';

export interface ChangePasswordData {
	current_password: string;
	new_password: string;
	new_password_confirm: string;
}

export const profileApi = {
	changePassword: (token: string, data: ChangePasswordData) =>
		apiClient.post<{ detail: string }>('/auth/change-password', data, token)
};
