import { Database } from 'sqlite';
import { initializeDatabase, getDatabase, closeDatabase } from './connection';
import { runMigrations } from './migrations';
import { UserRepository } from '../repositories/UserRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { BuddyRelationshipRepository } from '../repositories/BuddyRelationshipRepository';
import { BuddyRequestRepository } from '../repositories/BuddyRequestRepository';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database | null = null;
  private userRepository: UserRepository | null = null;
  private messageRepository: MessageRepository | null = null;
  private buddyRelationshipRepository: BuddyRelationshipRepository | null = null;
  private buddyRequestRepository: BuddyRequestRepository | null = null;

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.db = await initializeDatabase();
      await runMigrations(this.db);
      
      // Initialize repositories
      this.userRepository = new UserRepository(this.db);
      this.messageRepository = new MessageRepository(this.db);
      this.buddyRelationshipRepository = new BuddyRelationshipRepository(this.db);
      this.buddyRequestRepository = new BuddyRequestRepository(this.db);

      console.log('Database service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  async getDb(): Promise<Database> {
    if (!this.db) {
      await this.initialize();
    }
    return this.db!;
  }

  getUserRepository(): UserRepository {
    if (!this.userRepository) {
      throw new Error('Database service not initialized');
    }
    return this.userRepository;
  }

  getMessageRepository(): MessageRepository {
    if (!this.messageRepository) {
      throw new Error('Database service not initialized');
    }
    return this.messageRepository;
  }

  getBuddyRelationshipRepository(): BuddyRelationshipRepository {
    if (!this.buddyRelationshipRepository) {
      throw new Error('Database service not initialized');
    }
    return this.buddyRelationshipRepository;
  }

  getBuddyRequestRepository(): BuddyRequestRepository {
    if (!this.buddyRequestRepository) {
      throw new Error('Database service not initialized');
    }
    return this.buddyRequestRepository;
  }

  async close(): Promise<void> {
    await closeDatabase();
    this.db = null;
    this.userRepository = null;
    this.messageRepository = null;
    this.buddyRelationshipRepository = null;
    this.buddyRequestRepository = null;
  }

  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      const db = await this.getDb();
      await db.get('SELECT 1');
      return { status: 'healthy', message: 'Database connection is working' };
    } catch (error) {
      return { status: 'unhealthy', message: `Database connection failed: ${error}` };
    }
  }
}