import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from '../users/dtos/register.dto';
import { LoginDto } from '../users/dtos/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/user.entity';

const REFRESH_COOKIE = 'repoquery_refresh';
const REFRESH_COOKIE_PATH = '/api/auth';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) { }

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    async register(
        @Body() dto: RegisterDto,
        @Res({ passthrough: true }) response: Response,
    ) {
        const result = await this.authService.register(dto);
        this.setRefreshCookie(response, result.refreshToken);
        return {
            accessToken: result.accessToken,
            user: result.user,
        };
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Log in with email and password' })
    async login(
        @Body() dto: LoginDto,
        @Res({ passthrough: true }) response: Response,
    ) {
        const result = await this.authService.login(dto);
        this.setRefreshCookie(response, result.refreshToken);
        return {
            accessToken: result.accessToken,
            user: result.user,
        };
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh access token using the HttpOnly session cookie' })
    async refresh(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ) {
        this.assertTrustedOrigin(request);
        const refreshToken = request.cookies?.[REFRESH_COOKIE];
        if (typeof refreshToken !== 'string' || !refreshToken) {
            throw new ForbiddenException('Refresh session cookie is missing.');
        }
        const result = await this.authService.refreshTokens(refreshToken);
        this.setRefreshCookie(response, result.refreshToken);
        return {
            accessToken: result.accessToken,
            user: result.user,
        };
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    async getProfile(@CurrentUser() user: User) {
        return {
            id: user.id,
            email: user.email,
            createdAt: user.createdAt,
        };
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Log out current user' })
    async logout(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ) {
        this.assertTrustedOrigin(request);
        response.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
        return {
            message: 'Logout successful',
        };
    }

    private setRefreshCookie(response: Response, token: string): void {
        response.cookie(REFRESH_COOKIE, token, {
            ...this.refreshCookieOptions(),
            maxAge: REFRESH_COOKIE_MAX_AGE_MS,
        });
    }

    private refreshCookieOptions() {
        const isProduction =
            this.configService.get<string>('NODE_ENV') === 'production';
        return {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? ('none' as const) : ('lax' as const),
            path: REFRESH_COOKIE_PATH,
        };
    }

    private assertTrustedOrigin(request: Request): void {
        const origin = request.get('origin');
        const allowedOrigins = this.configService
            .get<string>(
                'ALLOWED_ORIGINS',
                'http://localhost:5173,http://localhost:5174',
            )
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);

        if (!origin || !allowedOrigins.includes(origin)) {
            throw new ForbiddenException('Request origin is not allowed.');
        }
    }
}