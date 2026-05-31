import type { Method, AxiosRequestConfig } from 'axios';

import { axiosInstance } from './axios';

export const request = async <T>(
  method: Method,
  url: string,
  data?: unknown,
  config: AxiosRequestConfig = {}
): Promise<T> => {
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;

  const response = await axiosInstance.request<T>({
    method,
    url: `/api${cleanUrl}`,
    data,
    ...config,
  });

  return response.data;
};

type ApiId = string | number;

export const axiosApiService = {
  getMany: <T, P extends object = object>(url: string, params?: P, config?: AxiosRequestConfig) =>
    request<T>('GET', url, undefined, { ...config, params }),

  getById: <T>(url: string, id: ApiId, config?: AxiosRequestConfig) =>
    request<T>('GET', `${url}/${id}`, undefined, config),

  getOne: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>('GET', url, undefined, config),

  post: <T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) =>
    request<T>('POST', url, data, config),

  patch: <T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) =>
    request<T>('PATCH', url, data, config),

  put: <T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) =>
    request<T>('PUT', url, data, config),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>('DELETE', url, undefined, config),
};