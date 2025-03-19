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
      { id: 3, name: "CamScanner", price: "3.14", icon: "SiCamscanner" },
      { id: 4, name: "MX Player", price: "2.50", icon: "SiMxlinux" },
      { id: 5, name: "VLC Media Player", price: "3.67", icon: "SiVlcmediaplayer" },
      { id: 6, name: "Kinemaster", price: "2.79", icon: "SiKinemaster" },
      { id: 7, name: "CapCut", price: "4.20", icon: "SiCapcut" },
      { id: 8, name: "PicsArt", price: "1.60", icon: "SiPicsart" },
      { id: 9, name: "Adobe Lightroom", price: "4.34", icon: "SiAdobelightroom" },
      { id: 10, name: "Canva", price: "3.11", icon: "SiCanva" },
      { id: 11, name: "Snapseed", price: "2.92", icon: "SiGoogle" },
      { id: 12, name: "InShot", price: "4.40", icon: "SiInstagram" },
      { id: 13, name: "Dropbox", price: "2.71", icon: "SiDropbox" },
      { id: 14, name: "OneDrive", price: "3.05", icon: "SiMicrosoftonedrive" },
      { id: 15, name: "Evernote", price: "4.12", icon: "SiEvernote" },
      { id: 16, name: "Notion", price: "1.99", icon: "SiNotion" },
      { id: 17, name: "Trello", price: "3.78", icon: "SiTrello" },
      { id: 18, name: "Asana", price: "2.61", icon: "SiAsana" },
      { id: 19, name: "Slack", price: "4.45", icon: "SiSlack" },
      { id: 20, name: "Discord", price: "3.20", icon: "SiDiscord" },
      { id: 21, name: "Google Pay", price: "4.10", icon: "SiGooglepay" },
      { id: 22, name: "PhonePe", price: "2.90", icon: "SiPhonepe" },
      { id: 23, name: "Paytm", price: "3.45", icon: "SiPaytm" },
      { id: 24, name: "Amazon Pay", price: "1.85", icon: "SiAmazonpay" },
      { id: 25, name: "WhatsApp", price: "3.52", icon: "SiWhatsapp" },
      { id: 26, name: "Facebook", price: "3.90", icon: "SiFacebook" },
      { id: 27, name: "Instagram", price: "2.06", icon: "SiInstagram" },
      { id: 28, name: "Twitter", price: "3.99", icon: "SiTwitter" },
      { id: 29, name: "LinkedIn", price: "2.11", icon: "SiLinkedin" },
      { id: 30, name: "Snapchat", price: "4.11", icon: "SiSnapchat" },
      { id: 31, name: "Telegram", price: "4.05", icon: "SiTelegram" },
      { id: 32, name: "Signal", price: "3.45", icon: "SiSignal" },
      { id: 33, name: "Pinterest", price: "2.91", icon: "SiPinterest" },
      { id: 34, name: "Quora", price: "4.67", icon: "SiQuora" },
      { id: 35, name: "Reddit", price: "2.47", icon: "SiReddit" },
      { id: 36, name: "Spotify", price: "1.65", icon: "SiSpotify" },
      { id: 37, name: "Netflix", price: "3.75", icon: "SiNetflix" },
      { id: 38, name: "YouTube", price: "4.89", icon: "SiYoutube" },
      { id: 39, name: "Amazon", price: "4.26", icon: "SiAmazon" },
      { id: 40, name: "Flipkart", price: "1.90", icon: "SiFlipkart" },
      { id: 41, name: "Swiggy", price: "2.33", icon: "SiSwiggy" },
      { id: 42, name: "Zomato", price: "2.16", icon: "SiZomato" },
      { id: 43, name: "Uber", price: "3.00", icon: "SiUber" },
      { id: 44, name: "Ola", price: "1.58", icon: "SiOla" },
      { id: 45, name: "Myntra", price: "3.20", icon: "SiMyntra" },
      { id: 46, name: "CRED", price: "1.31", icon: "SiCred" },
      { id: 47, name: "Groww", price: "1.95", icon: "SiGroww" },
      { id: 48, name: "Zerodha", price: "3.75", icon: "SiZerodha" },
      { id: 49, name: "Upstox", price: "2.10", icon: "SiUpstox" },
      { id: 50, name: "CoinDCX", price: "4.28", icon: "SiCoindcx" },
      { id: 51, name: "5Paisa", price: "2.50", icon: "Si5paisa" },
      { id: 52, name: "Angel One", price: "4.15", icon: "SiAngellist" },
      { id: 53, name: "Dhani", price: "1.82", icon: "SiD" },
      { id: 54, name: "PolicyBazaar", price: "2.78", icon: "SiPolicybazaar" },
      { id: 55, name: "Tata Neu", price: "3.39", icon: "SiTata" },
      { id: 56, name: "BigBasket", price: "2.65", icon: "SiBigbasket" },
      { id: 57, name: "Blinkit", price: "4.10", icon: "SiBlinkit" },
      { id: 58, name: "JioMart", price: "1.53", icon: "SiJio" },
      { id: 59, name: "Nykaa", price: "3.29", icon: "SiNykaa" },
      { id: 60, name: "Domino's", price: "2.95", icon: "SiDominos" },
      { id: 61, name: "McDonald's", price: "2.46", icon: "SiMcdonalds" },
      { id: 62, name: "KFC", price: "1.70", icon: "SiKfc" },
      { id: 63, name: "PVR Cinemas", price: "4.20", icon: "SiPvr" },
      { id: 64, name: "BookMyShow", price: "2.41", icon: "SiBookmyshow" },
      { id: 65, name: "Razorpay", price: "2.11", icon: "SiRazorpay" },
      { id: 66, name: "BharatPe", price: "2.90", icon: "SiBharatpe" },
      { id: 67, name: "WazirX", price: "3.45", icon: "SiWazirx" },
      { id: 68, name: "HDFC Bank", price: "3.64", icon: "SiHdfc" },
      { id: 69, name: "CoinSwitch", price: "1.57", icon: "SiCoinswitch" },
      { id: 70, name: "Mobikwik", price: "2.75", icon: "SiMobikwik" },
      { id: 71, name: "Freecharge", price: "1.95", icon: "SiFreecharge" },
      { id: 72, name: "Airtel Thanks", price: "3.60", icon: "SiAirtel" },
      { id: 73, name: "Jio Payments", price: "2.50", icon: "SiJio" },
      { id: 74, name: "Ola Money", price: "4.20", icon: "SiOla" },
      { id: 75, name: "Swiggy Money", price: "3.10", icon: "SiSwiggy" },
      { id: 76, name: "Uber Wallet", price: "2.05", icon: "SiUber" },
      { id: 77, name: "Zomato Pay", price: "1.70", icon: "SiZomato" },
      { id: 78, name: "Rapido Wallet", price: "2.85", icon: "SiRapido" },
      { id: 79, name: "IRCTC Wallet", price: "4.00", icon: "SiIndianrailways" },
      { id: 80, name: "Amazon Prime", price: "2.40", icon: "SiAmazonprime" },
      { id: 81, name: "Hotstar", price: "4.35", icon: "SiHotstar" },
      { id: 82, name: "SonyLiv", price: "1.95", icon: "SiSony" },
      { id: 83, name: "Voot", price: "3.10", icon: "SiVoot" },
      { id: 84, name: "ZEE5", price: "2.60", icon: "SiZee5" },
      { id: 85, name: "Tata Play", price: "4.20", icon: "SiTataplay" },
      { id: 86, name: "Airtel DTH", price: "1.75", icon: "SiAirtel" },
      { id: 87, name: "DishTV", price: "3.90", icon: "SiDishtv" },
      { id: 88, name: "Sun Direct", price: "2.30", icon: "SiSundirect" },
      { id: 89, name: "JioCinema", price: "4.50", icon: "SiJio" },
      { id: 90, name: "MX Player", price: "2.80", icon: "SiMxplayer" },
      { id: 91, name: "Gaana", price: "3.55", icon: "SiGaana" },
      { id: 92, name: "Wynk Music", price: "2.95", icon: "SiWynk" },
      { id: 93, name: "Saavn", price: "4.05", icon: "SiJiosaavn" },
      { id: 94, name: "Hungama Music", price: "1.50", icon: "SiHungama" }
    ];

    services.forEach(service => {
      this.otpServices.set(service.id, service);
    });
  }
}

export const storage = new MemStorage();