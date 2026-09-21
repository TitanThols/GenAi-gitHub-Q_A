import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RepoStatus {
  PENDING = 'pending',
  CLONING = 'cloning',
  CHUNKING = 'chunking',
  EMBEDDING = 'embedding',
  INDEXED = 'indexed',
  FAILED = 'failed',
}

@Entity('repos')
export class Repo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @Column()
  name: string;

  @Column({ default: 'main' })
  defaultBranch: string;

  @Column({
    type: 'enum',
    enum: RepoStatus,
    default: RepoStatus.PENDING,
  })
  status: RepoStatus;

  @Column({ type: 'int', default: 0 })
  totalFiles: number;

  @Column({ type: 'int', default: 0 })
  totalChunks: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
