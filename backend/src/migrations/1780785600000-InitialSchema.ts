import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1780785600000 implements MigrationInterface {
    name = 'InitialSchema1780785600000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."repos_status_enum" AS ENUM (
                    'pending',
                    'cloning',
                    'chunking',
                    'embedding',
                    'indexed',
                    'failed'
                );
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "users" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "email" character varying NOT NULL,
                "passwordHash" character varying NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_users_email" UNIQUE ("email")
            );
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "repos" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "url" character varying NOT NULL,
                "name" character varying NOT NULL,
                "defaultBranch" character varying NOT NULL DEFAULT 'main',
                "status" "public"."repos_status_enum" NOT NULL DEFAULT 'pending',
                "totalFiles" integer NOT NULL DEFAULT 0,
                "totalChunks" integer NOT NULL DEFAULT 0,
                "errorMessage" text,
                "userId" uuid,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_repos_id" PRIMARY KEY ("id")
            );
        `);

        await queryRunner.query(`
            ALTER TABLE "repos"
                ADD COLUMN IF NOT EXISTS "defaultBranch" character varying NOT NULL DEFAULT 'main',
                ADD COLUMN IF NOT EXISTS "status" "public"."repos_status_enum" NOT NULL DEFAULT 'pending',
                ADD COLUMN IF NOT EXISTS "totalFiles" integer NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "totalChunks" integer NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "errorMessage" text,
                ADD COLUMN IF NOT EXISTS "userId" uuid,
                ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT now();
        `);
    }

    async down(_queryRunner: QueryRunner): Promise<void> {
        throw new Error(
            'InitialSchema is intentionally irreversible to prevent deleting user and repository data.',
        );
    }
}
