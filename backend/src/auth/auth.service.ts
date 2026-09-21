import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/users.service';
import { RegisterDto } from '../users/dtos/register.dto';
import { LoginDto } from '../users/dtos/login.dto';
import { JwtPayload } from './strategies/auth.strategy';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UserService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async register(dto: RegisterDto) {
        const password = await bcrypt.hash(dto.password, SALT_ROUNDS);
        const user = await this.usersService.create(dto.email, password);
        const tokens = await this.generateTokens(user.id, user.email);

        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
            },
        };
    }

    async login(dto: LoginDto) {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user) {
            throw new UnauthorizedException("Invalid Credentials");
        }

        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedException("Invalid Credentials");
        }

        const tokens = await this.generateTokens(user.id, user.email);
        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
            },
        };
    }

    async refreshTokens(refreshToken: string) {
        try {
            const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
                secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
            });

            const user = await this.usersService.findById(payload.sub);
            if (!user) {
                throw new UnauthorizedException("User no longer exists");
            }

            const tokens = await this.generateTokens(user.id, user.email);
            return {
                ...tokens,
                user: {
                    id: user.id,
                    email: user.email,
                },
            };
        } catch (error) {
            throw new UnauthorizedException("Refresh token is invalid or expired");
        }
    }

    private async generateTokens(userId: string, email: string) {
        const payload: JwtPayload = { sub: userId, email };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
                expiresIn: '15m',
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
                expiresIn: '7d',
            })
        ]);

        return { accessToken, refreshToken };
    }
}