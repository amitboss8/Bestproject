import { User, Transaction, OTPService, InsertUser } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { randomBytes } from "crypto";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByReferCode(referCode: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateWalletBalance(userId: number, amount: number): Promise<User>;
  createTransaction(userId: number, amount: number, utrNumber: string, type?: string): Promise<Transaction>;
  getTransactions(userId: number): Promise<Transaction[]>;
  getOTPServices(): Promise<OTPService[]>;
  getReferralStats(userId: number): Promise<{ totalInvites: number, successfulReferrals: number, totalEarned: number }>;
  processReferralReward(newUserId: number): Promise<void>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private transactions: Map<number, Transaction>;
  private otpServices: Map<number, OTPService>;
  private currentId: number;
  private currentTransactionId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.transactions = new Map();
    this.otpServices = new Map();
    this.currentId = 1;
    this.currentTransactionId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });

    this.initializeOTPServices();
  }

  private generateReferCode(): string {
    return `USER${randomBytes(2).toString('hex').toUpperCase()}`;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByReferCode(referCode: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.referCode === referCode,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = {
      ...insertUser,
      id,
      walletBalance: "0",
      referCode: this.generateReferCode(),
      referredBy: insertUser.referredBy || null,
      referralRewardClaimed: "no"
    };
    this.users.set(id, user);
    return user;
  }

  async updateWalletBalance(userId: number, amount: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const newBalance = parseFloat(user.walletBalance) + amount;
    const updatedUser = { ...user, walletBalance: newBalance.toString() };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async createTransaction(userId: number, amount: number, utrNumber: string, type: string = "deposit"): Promise<Transaction> {
    const id = this.currentTransactionId++;
    const transaction: Transaction = {
      id,
      userId,
      amount: amount.toString(),
      utrNumber,
      status: "pending",
      createdAt: new Date(),
      type
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async getTransactions(userId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getOTPServices(): Promise<OTPService[]> {
    return Array.from(this.otpServices.values());
  }

  async getReferralStats(userId: number): Promise<{ totalInvites: number, successfulReferrals: number, totalEarned: number }> {
    const users = Array.from(this.users.values());
    const referredUsers = users.filter(user => user.referredBy === userId.toString());

    const transactions = Array.from(this.transactions.values());
    const referralBonuses = transactions.filter(t => 
      t.userId === userId && 
      t.type === "referral_bonus" &&
      t.status === "approved"
    );

    const totalEarned = referralBonuses.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return {
      totalInvites: referredUsers.length,
      successfulReferrals: referralBonuses.length,
      totalEarned
    };
  }

  async processReferralReward(newUserId: number): Promise<void> {
    const user = await this.getUser(newUserId);
    if (!user || !user.referredBy || user.referralRewardClaimed === "yes") return;

    const referrer = await this.getUserByReferCode(user.referredBy);
    if (!referrer) return;

    // Add bonus to referrer
    await this.updateWalletBalance(referrer.id, 30);
    await this.createTransaction(
      referrer.id,
      30,
      `REF_${user.username}`,
      "referral_bonus"
    );

    // Add bonus to new user
    await this.updateWalletBalance(user.id, 30);
    await this.createTransaction(
      user.id,
      30,
      `REF_BONUS`,
      "referral_bonus"
    );

    // Mark referral as claimed
    const updatedUser = { ...user, referralRewardClaimed: "yes" };
    this.users.set(user.id, updatedUser);
  }

  private initializeOTPServices() {
    const services = [
      { id: 1, name: "Google Photos", price: "4.53", icon: "SiGooglephotos" },
      { id: 2, name: "Adobe Scan", price: "1.22", icon: "SiAdobeacrobatreader" },
      { id: 3, name: "WhatsApp", price: "3.52", icon: "SiWhatsapp" },
      // Add more services from the list...
    ];

    services.forEach(service => {
      this.otpServices.set(service.id, service);
    });
  }
}

export const storage = new MemStorage();