import { Test, TestingModule } from '@nestjs/testing';
import { AstChunkerService } from './ast-chunker.service';

const MOCK_PYTHON_CODE = `
class UserService:
    def __init__(self, db):
        self.db = db

    def get_user(self, user_id: int):
        return self.db.find(user_id)

    async def delete_user(self, user_id: int):
        return self.db.delete(user_id)

def send_welcome_email(email: str):
    print(f"Sending email to {email}")
`;

describe('AstChunkerService', () => {
    let service: AstChunkerService;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [AstChunkerService],
        }).compile();

        service = module.get<AstChunkerService>(AstChunkerService);

        await service.onModuleInit();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should extract the class chunk', () => {
        const chunks = service.chunkPythonCode('test.py', MOCK_PYTHON_CODE);
        const classChunks = chunks.filter(c => c.type === 'class');

        expect(classChunks).toHaveLength(1);
        expect(classChunks[0].name).toBe('UserService');
    });

    it('should extract methods with parentClass set', () => {
        const chunks = service.chunkPythonCode('test.py', MOCK_PYTHON_CODE);
        const methods = chunks.filter(c => c.type === 'method');

        expect(methods).toHaveLength(3);
        expect(methods.every(m => m.parentClass === 'UserService')).toBe(true);
    });

    it('should extract top-level functions', () => {
        const chunks = service.chunkPythonCode('test.py', MOCK_PYTHON_CODE);
        const fns = chunks.filter(c => c.type === 'function');

        expect(fns).toHaveLength(1);
        expect(fns[0].name).toBe('send_welcome_email');
        expect(fns[0].parentClass).toBeUndefined();
    });

    it('should have correct line numbers', () => {
        const chunks = service.chunkPythonCode('test.py', MOCK_PYTHON_CODE);
        const getUser = chunks.find(c => c.name === 'get_user');

        expect(getUser?.startLine).toBeGreaterThan(0);
        expect(getUser?.endLine).toBeGreaterThanOrEqual(getUser?.startLine ?? 0);
    });
});
