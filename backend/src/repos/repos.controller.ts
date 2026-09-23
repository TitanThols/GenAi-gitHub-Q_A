import { Controller, Get, Post, Delete, Param, UseGuards, Request, Body } from '@nestjs/common';
import { RepoService } from './repos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class CreateRepoDto {
    url: string;
}

@Controller('api/repos')
export class ReposController {
    constructor(private readonly reposService: RepoService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    async create(@Body() body: CreateRepoDto, @Request() req: any) {
        const userId = req.user?.id;
        return this.reposService.create(body.url, userId);
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    async findAll(@Request() req: any) {
        const userId = req.user?.id;
        return this.reposService.findAll(userId);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.reposService.findOne(id);
    }
    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    async remove(@Param('id') id: string) {
        return this.reposService.remove(id);
    }
}


