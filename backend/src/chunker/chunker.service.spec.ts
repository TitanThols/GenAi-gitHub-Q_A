import { Test, TestingModule } from '@nestjs/testing';
import { ChunkerService } from './chunker.service';

describe('ChunkerService', () => {
    let service: ChunkerService;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ChunkerService],
        }).compile();

        service = module.get<ChunkerService>(ChunkerService);
        await service.onModuleInit();
    });

    it('should be defined and initialized', () => {
        expect(service).toBeDefined();
    });

    const PYTHON = `
class UserService:
    def __init__(self, db):
        self.db = db

    def get_user(self, user_id: int):
        return self.db.find(user_id)

def send_email(email: str):
    print(email)
`;

    const TS = `
export interface UserProfile {
    id: string;
}

export type UserRole = 'admin' | 'user';

export class AuthService {
    login(email: string): boolean { return true; }
}

export function validateEmail(email: string): boolean {
    return email.includes('@');
}

export const hashToken = (token: string): string => token.trim();
`;

    const JS = `
class Logger {
    log(msg) { console.log(msg); }
}

function add(a, b) { return a + b; }

const multiply = (x, y) => x * y;
`;

    describe('Python', () => {
        it('extracts the class', () => {
            const chunks = service.chunkFile('user.py', PYTHON);
            const classes = chunks.filter(c => c.type === 'class');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('UserService');
        });

        it('extracts methods with parentClass', () => {
            const chunks = service.chunkFile('user.py', PYTHON);
            const methods = chunks.filter(c => c.type === 'method');
            expect(methods).toHaveLength(2);
            expect(methods.every(m => m.parentClass === 'UserService')).toBe(true);
        });

        it('extracts top-level functions', () => {
            const chunks = service.chunkFile('user.py', PYTHON);
            const fns = chunks.filter(c => c.type === 'function');
            expect(fns).toHaveLength(1);
            expect(fns[0].name).toBe('send_email');
        });
    });

    describe('TypeScript', () => {
        it('extracts interfaces', () => {
            const chunks = service.chunkFile('auth.service.ts', TS);
            const ifaces = chunks.filter(c => c.type === 'interface');
            expect(ifaces).toHaveLength(1);
            expect(ifaces[0].name).toBe('UserProfile');
        });

        it('extracts type aliases', () => {
            const chunks = service.chunkFile('auth.service.ts', TS);
            expect(chunks.find(c => c.type === 'type')?.name).toBe('UserRole');
        });

        it('extracts class and method', () => {
            const chunks = service.chunkFile('auth.service.ts', TS);
            expect(chunks.find(c => c.type === 'class')?.name).toBe('AuthService');
            const login = chunks.find(c => c.name === 'login');
            expect(login?.type).toBe('method');
            expect(login?.parentClass).toBe('AuthService');
        });

        it('extracts function declaration and arrow function', () => {
            const chunks = service.chunkFile('auth.service.ts', TS);
            const fns = chunks.filter(c => c.type === 'function');
            expect(fns.map(f => f.name)).toContain('validateEmail');
            expect(fns.map(f => f.name)).toContain('hashToken');
        });
    });

    describe('JavaScript', () => {
        it('extracts class, method, functions', () => {
            const chunks = service.chunkFile('utils.js', JS);
            expect(chunks.find(c => c.type === 'class')?.name).toBe('Logger');
            expect(chunks.find(c => c.type === 'method')?.name).toBe('log');
            const fns = chunks.filter(c => c.type === 'function');
            expect(fns.map(f => f.name)).toContain('add');
            expect(fns.map(f => f.name)).toContain('multiply');
        });
    });

    describe('Edge Cases', () => {
        it('returns [] for unsupported extensions', () => {
            expect(service.chunkFile('readme.md', '# Hello')).toEqual([]);
        });

        it('returns [] for empty file', () => {
            expect(service.chunkFile('empty.ts', '')).toEqual([]);
        });

        it('still extracts valid chunks from a file with syntax errors', () => {
            const brokenTs = `
                function workingFn() { return 42; }
                function broken( {
            `;
            const chunks = service.chunkFile('broken.ts', brokenTs);
            expect(chunks.find(c => c.name === 'workingFn')).toBeDefined();
        });
    });
});