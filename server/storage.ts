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
  getAdminStats(): Promise<{
    totalUsers: number;
    totalDeposits: string;
    todayDeposits: string;
  }>;
  getPendingTransactions(): Promise<Transaction[]>;
  updateTransactionStatus(
    transactionId: number,
    status: "approved" | "rejected"
  ): Promise<Transaction>;
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
      { id: 94, name: "Hungama Music", price: "1.50", icon: "SiHungama" },
      { id: 95, name: "Google One", price: "3.80", icon: "SiGoogle" },
      { id: 96, name: "Dropbox", price: "2.65", icon: "SiDropbox" },
      { id: 97, name: "OneDrive", price: "4.50", icon: "SiMicrosoftonedrive" },
      { id: 98, name: "Mega Cloud", price: "1.95", icon: "SiMega" },
      { id: 99, name: "iCloud", price: "3.40", icon: "SiApple" },
      { id: 100, name: "Adobe Creative", price: "4.20", icon: "SiAdobecreativecloud" },
      { id: 101, name: "Canva Pro", price: "2.75", icon: "SiCanva" },
      { id: 102, name: "Grammarly", price: "1.85", icon: "SiGrammarly" },
      { id: 103, name: "Notion Plus", price: "3.10", icon: "SiNotion" },
      { id: 104, name: "Evernote", price: "2.45", icon: "SiEvernote" },
      { id: 105, name: "Todoist", price: "4.00", icon: "SiTodoist" },
      { id: 106, name: "Asana", price: "3.25", icon: "SiAsana" },
      { id: 107, name: "Trello", price: "2.10", icon: "SiTrello" },
      { id: 108, name: "Zoom Premium", price: "4.35", icon: "SiZoom" },
      { id: 109, name: "Microsoft 365", price: "1.75", icon: "SiMicrosoft" },
      { id: 110, name: "Google Workspace", price: "3.90", icon: "SiGooglecloud" },
      { id: 111, name: "Slack Pro", price: "2.30", icon: "SiSlack" },
      { id: 112, name: "Discord Nitro", price: "4.25", icon: "SiDiscord" },
      { id: 113, name: "LinkedIn Premium", price: "2.95", icon: "SiLinkedin" },
      { id: 114, name: "Coursera Plus", price: "3.50", icon: "SiCoursera" },
      { id: 115, name: "Udemy Courses", price: "1.65", icon: "SiUdemy" },
      { id: 116, name: "Skillshare", price: "2.85", icon: "SiSkillshare" },
      { id: 117, name: "MasterClass", price: "4.10", icon: "SiMastercard" },
      { id: 118, name: "Duolingo Plus", price: "1.50", icon: "SiDuolingo" },
      { id: 119, name: "Flipkart Plus", price: "3.60", icon: "SiFlipkart" },
      { id: 120, name: "Amazon Shopping", price: "2.75", icon: "SiAmazon" },
      { id: 121, name: "Myntra Insider", price: "4.40", icon: "SiMyntra" },
      { id: 122, name: "Ajio Gold", price: "1.90", icon: "SiAjio" },
      { id: 123, name: "Tata Cliq", price: "3.20", icon: "SiTata" },
      { id: 124, name: "Snapdeal Select", price: "2.85", icon: "SiSnapdeal" },
      { id: 125, name: "Meesho Elite", price: "4.00", icon: "SiMeesho" },
      { id: 126, name: "Pepperfry Club", price: "3.45", icon: "SiPepperfry" },
      { id: 127, name: "Urbanic", price: "2.50", icon: "SiUrbanic" },
      { id: 128, name: "Lenskart Gold", price: "4.10", icon: "SiLenskart" },
      { id: 129, name: "FirstCry Club", price: "1.95", icon: "SiFirstcry" },
      { id: 130, name: "Mamaearth Rewards", price: "3.30", icon: "SiMamaearth" },
      { id: 131, name: "Boat Nirvana Club", price: "2.40", icon: "SiBoat" },
      { id: 132, name: "Noise Fit", price: "4.25", icon: "SiNoise" },
      { id: 133, name: "Cult.fit", price: "1.85", icon: "SiCultfit" },
      { id: 134, name: "HealthifyMe", price: "3.70", icon: "SiHealthifyme" },
      { id: 135, name: "Practo Plus", price: "2.65", icon: "SiPracto" },
      { id: 136, name: "PharmEasy Plus", price: "4.00", icon: "SiPharmeasy" },
      { id: 137, name: "Netmeds First", price: "1.55", icon: "SiNetmeds" },
      { id: 138, name: "MedLife Gold", price: "3.25", icon: "SiMedlife" },
      { id: 139, name: "1mg Care Plan", price: "2.95", icon: "Si1mg" },
      { id: 140, name: "Zepto Membership", price: "4.50", icon: "SiZepto" },
      { id: 141, name: "Dunzo Gold", price: "1.80", icon: "SiDunzo" },
      { id: 142, name: "Blinkit Prime", price: "3.90", icon: "SiBlinkit" }
    ];

    services.forEach(service => {
      this.otpServices.set(service.id, service);
    });
  }

  async getAdminStats() {
    const users = Array.from(this.users.values());
    const transactions = Array.from(this.transactions.values());
    const approvedTransactions = transactions.filter(t => t.status === "approved");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = approvedTransactions.filter(t => {
      const txDate = new Date(t.createdAt);
      return txDate >= today;
    });

    const totalDeposits = approvedTransactions.reduce(
      (sum, t) => sum + parseFloat(t.amount),
      0
    );

    const todayDeposits = todayTransactions.reduce(
      (sum, t) => sum + parseFloat(t.amount),
      0
    );

    return {
      totalUsers: users.length,
      totalDeposits: totalDeposits.toString(),
      todayDeposits: todayDeposits.toString()
    };
  }

  async getPendingTransactions(): Promise<Transaction[]> {
    const pendingTransactions = Array.from(this.transactions.values())
      .filter(t => t.status === "pending")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Add username to each transaction
    const enrichedTransactions = await Promise.all(
      pendingTransactions.map(async t => {
        const user = await this.getUser(t.userId);
        return { ...t, username: user?.username };
      })
    );

    return enrichedTransactions;
  }

  async updateTransactionStatus(
    transactionId: number,
    status: "approved" | "rejected"
  ): Promise<Transaction> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) throw new Error("Transaction not found");

    const updatedTransaction = { ...transaction, status };
    this.transactions.set(transactionId, updatedTransaction);

    // Only update wallet balance if transaction is newly approved
    if (status === "approved" && transaction.status !== "approved") {
      await this.updateWalletBalance(transaction.userId, parseFloat(transaction.amount));
    }

    return updatedTransaction;
  }
}

export const storage = new MemStorage();