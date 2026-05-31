import axios from 'axios';
import Cookies from 'js-cookie';

import { ACCESS_TOKEN_KEY, LOCALE_KEY } from '@/config/constants';
import { env } from '@/config/env';

const axiosInstance = axios.create({
    baseURL: env.serverUrl,
    // timeout: REQUEST_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
    },
});

axiosInstance.interceptors.request.use(
    async (config) => {
        let token: string | undefined;

        if (typeof window !== 'undefined') {
            // token = Cookies.get(ACCESS_TOKEN_KEY);
            token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiMmQ0NTJkNi03NzkzLTQwNjktOGExNy02ZmRkNTg4OWE1NDkiLCJwaG9uZSI6IisyMDEwMDAwMDAwMDEiLCJyb2xlSWQiOiIwZjhkYjE2Zi0wMThjLTQ0MjEtOGEzZC0wNmM1MDk4NzEwYWMiLCJsYWJJZCI6IjBiZTA1YjRlLWYyMzctNDBkNy05NWM1LTc4YjMyZTMyN2NlMyIsImJyYW5jaElkcyI6W10sImhhc0FsbEJyYW5jaGVzIjpmYWxzZSwiaWF0IjoxNzc2MzQzNjk2LCJleHAiOjE3NzYzNDQ1OTZ9.D_GLeKyhBa_HgK2vRklNmFzznxUNcEkGiZl2uFhVIN4"
        } else {
            try {
                const { cookies } = await import('next/headers');
                const cookieStore = await cookies();
                token = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
            } catch (e) {
                console.error("AXIOS REQUEST ERROR: ", e)
            }
        }

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        const lang = Cookies.get(LOCALE_KEY) || 'ar';
        config.headers['Accept-Language'] = lang;

        return config;
    },
    (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined') {
                Cookies.remove(ACCESS_TOKEN_KEY);
            }
        }
        return Promise.reject(error.response?.data || error);
    }
);

export { axiosInstance };