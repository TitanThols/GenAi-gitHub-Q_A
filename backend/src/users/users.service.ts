import { Injectable, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./user.entity";

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    async create(email: string, passwordHash: string): Promise<User> {
        const existing = await this.userRepo.findOneBy({ email });

        if (existing) {
            throw new ConflictException("Email is already registered");
        }

        const user = this.userRepo.create({ email, passwordHash });
        return this.userRepo.save(user);
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepo.findOneBy({ email });
    }

    async findById(id: string): Promise<User | null> {
        return this.userRepo.findOneBy({ id });
    }
}