import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    UseGuards,
    Body,
    Query,
} from '@nestjs/common';
import { RepoService } from './repos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';

import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

class CreateRepoDto {
    @IsNotEmpty()
    @IsString()
    url: string;
}

class SourceQueryDto {
    @IsNotEmpty()
    @IsString()
    path: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    line: number;
}

@Controller('repos')
@UseGuards(JwtAuthGuard)
export class ReposController {
    constructor(private readonly reposService: RepoService) { }

    @Post()
    async create(@Body() body: CreateRepoDto, @CurrentUser() user: User) {
        return this.reposService.create(body.url, user.id);
    }

    @Get()
    async findAll(@CurrentUser() user: User) {
        return this.reposService.findAll(user.id);
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @CurrentUser() user: User) {
        return this.reposService.findOne(id, user.id);
    }

    @Get(':id/source')
    async getSource(
        @Param('id') id: string,
        @Query() query: SourceQueryDto,
        @CurrentUser() user: User,
    ) {
        return this.reposService.getSourceChunk(
            id,
            user.id,
            query.path,
            query.line,
        );
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @CurrentUser() user: User) {
        return this.reposService.remove(id, user.id);
    }
}
