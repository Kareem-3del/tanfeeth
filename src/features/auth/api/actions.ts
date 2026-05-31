import { apiEndPoints } from "@/config/endpoints";
import { axiosApiService } from "@/lib/axios/request";

import type { LoginApiRequest } from "../types/request"
import type { AuthResponse } from "../types/response"
import { SignupApiRequest } from './../types/request';

export const login = (data: LoginApiRequest): Promise<AuthResponse> => axiosApiService.post(apiEndPoints.auth.login, data);

export const signup = (data: SignupApiRequest): Promise<AuthResponse> => axiosApiService.post(apiEndPoints.auth.signup, data);

export const restoreSession = () => axiosApiService.post(apiEndPoints.auth.refreshToken);
export const logout = () => axiosApiService.post(apiEndPoints.auth.logout);