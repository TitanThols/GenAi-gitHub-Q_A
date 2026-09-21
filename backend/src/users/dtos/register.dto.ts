import { IsEmail, IsString, MinLength, MaxLength } from "class-validator";

export class RegisterDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8, { message: 'Password must be atleast 8 characters' })
    @MaxLength(32, { message: 'Password must not exceed 32 characters' })
    password: string;
}