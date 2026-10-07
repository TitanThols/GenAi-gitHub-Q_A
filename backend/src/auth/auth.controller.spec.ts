import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

describe('AuthController refresh cookie', () => {
    let controller: AuthController;
    let authService: jest.Mocked<
        Pick<AuthService, 'login' | 'register' | 'refreshTokens'>
    >;
    let response: jest.Mocked<Pick<Response, 'cookie' | 'clearCookie'>>;

    beforeEach(() => {
        authService = {
            login: jest.fn(),
            register: jest.fn(),
            refreshTokens: jest.fn(),
        };
        const configService = {
            get: jest.fn((name: string) =>
                name === 'NODE_ENV' ? 'production' : 'https://app.example.com',
            ),
        };
        response = {
            cookie: jest.fn(),
            clearCookie: jest.fn(),
        };
        controller = new AuthController(
            authService as unknown as AuthService,
            configService as unknown as ConfigService,
        );
    });

    it('sets an HttpOnly secure cookie and excludes the refresh token from login JSON', async () => {
        authService.login.mockResolvedValue({
            accessToken: 'access',
            refreshToken: 'refresh-secret',
            user: { id: 'user-id', email: 'user@example.com' },
        });

        const result = await controller.login(
            { email: 'user@example.com', password: 'password' },
            response as unknown as Response,
        );

        expect(result).toEqual({
            accessToken: 'access',
            user: { id: 'user-id', email: 'user@example.com' },
        });
        expect(response.cookie).toHaveBeenCalledWith(
            'repoquery_refresh',
            'refresh-secret',
            expect.objectContaining({
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                path: '/api/auth',
            }),
        );
    });

    it('reads refresh credentials only from the cookie and checks the origin', async () => {
        authService.refreshTokens.mockResolvedValue({
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            user: { id: 'user-id', email: 'user@example.com' },
        });
        const request = {
            get: jest.fn().mockReturnValue('https://app.example.com'),
            cookies: { repoquery_refresh: 'old-refresh' },
        } as unknown as Request;

        const result = await controller.refresh(
            request,
            response as unknown as Response,
        );

        expect(authService.refreshTokens).toHaveBeenCalledWith('old-refresh');
        expect(result).toEqual({
            accessToken: 'new-access',
            user: { id: 'user-id', email: 'user@example.com' },
        });
        expect(response.cookie).toHaveBeenCalledWith(
            'repoquery_refresh',
            'new-refresh',
            expect.any(Object),
        );
    });

    it('rejects refresh requests from untrusted origins', async () => {
        const request = {
            get: jest.fn().mockReturnValue('https://attacker.example'),
            cookies: { repoquery_refresh: 'refresh' },
        } as unknown as Request;

        await expect(
            controller.refresh(request, response as unknown as Response),
        ).rejects.toThrow('Request origin is not allowed.');
        expect(authService.refreshTokens).not.toHaveBeenCalled();
    });

    it('clears the refresh cookie on logout', async () => {
        const request = {
            get: jest.fn().mockReturnValue('https://app.example.com'),
        } as unknown as Request;

        await controller.logout(request, response as unknown as Response);

        expect(response.clearCookie).toHaveBeenCalledWith(
            'repoquery_refresh',
            expect.objectContaining({
                httpOnly: true,
                secure: true,
                path: '/api/auth',
            }),
        );
    });
});
