import type { QueryRunner } from 'typeorm';
import { InitialSchema1780785600000 } from './1780785600000-InitialSchema';

describe('InitialSchema1780785600000', () => {
    it('creates missing application tables while preserving existing repo tables', async () => {
        const queryRunner = {
            query: jest.fn().mockResolvedValue(undefined),
        } as unknown as QueryRunner;

        await new InitialSchema1780785600000().up(queryRunner);

        const statements = jest.mocked(queryRunner.query).mock.calls.map(([sql]) => sql);
        expect(statements).toHaveLength(4);
        expect(statements.join('\n')).toContain('CREATE TABLE IF NOT EXISTS "users"');
        expect(statements.join('\n')).toContain('CREATE TABLE IF NOT EXISTS "repos"');
        expect(statements.join('\n')).toContain('ADD COLUMN IF NOT EXISTS "userId"');
        expect(statements.join('\n')).toContain('repos_status_enum');
    });

    it('refuses to reverse the initial schema because that would delete user data', async () => {
        await expect(
            new InitialSchema1780785600000().down({} as QueryRunner),
        ).rejects.toThrow('intentionally irreversible');
    });
});
