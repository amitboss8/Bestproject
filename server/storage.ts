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
      { id: 1, name: "WhatsApp", price: "3.00", icon: "SiWhatsapp" },
      { id: 2, name: "Telegram", price: "2.00", icon: "SiTelegram" },
      { id: 3, name: "Instagram", price: "4.00", icon: "SiInstagram" },
      { id: 4, name: "Facebook", price: "3.00", icon: "SiFacebook" },
      { id: 5, name: "Snapchat", price: "4.00", icon: "SiSnapchat" },
      { id: 6, name: "Twitter (X)", price: "5.00", icon: "SiTwitter" },
      { id: 7, name: "TikTok", price: "2.00", icon: "SiTiktok" },
      { id: 8, name: "Hike", price: "1.00", icon: "SiHipchat" },
      { id: 9, name: "Reddit", price: "3.00", icon: "SiReddit" },
      { id: 10, name: "Discord", price: "2.00", icon: "SiDiscord" },
      { id: 11, name: "Clubhouse", price: "3.00", icon: "SiClubhouse" },
      { id: 12, name: "Threads", price: "2.00", icon: "SiThreads" },
      { id: 13, name: "Amazon", price: "4.00", icon: "SiAmazon" },
      { id: 14, name: "Flipkart", price: "5.00", icon: "SiFlipkart" },
      { id: 15, name: "Myntra", price: "3.00", icon: "SiMyntra" },
      { id: 16, name: "Ajio", price: "4.00", icon: "SiAframe" },
      { id: 17, name: "Nykaa", price: "3.00", icon: "SiNintendo" },
      { id: 18, name: "Tata CLiQ", price: "5.00", icon: "SiTata" },
      { id: 19, name: "Meesho", price: "2.00", icon: "SiMessenger" },
      { id: 20, name: "ShopClues", price: "3.00", icon: "SiShopify" },
      { id: 21, name: "Snapdeal", price: "2.00", icon: "SiSnapcraft" },
      { id: 22, name: "Paytm Mall", price: "4.00", icon: "SiPatreon" },
      { id: 23, name: "LimeRoad", price: "2.00", icon: "SiLighthouse" },
      { id: 24, name: "Bewakoof", price: "3.00", icon: "SiBandcamp" },
      { id: 25, name: "1mg", price: "4.00", icon: "SiOneplus" },
      { id: 26, name: "PharmEasy", price: "3.00", icon: "SiPhabricator" },
      { id: 27, name: "BigBasket", price: "5.00", icon: "SiBigbasket" },
      { id: 28, name: "Blinkit", price: "4.00", icon: "SiBlender" },
      { id: 29, name: "JioMart", price: "3.00", icon: "SiJirasoftware" },
      { id: 30, name: "Netflix", price: "5.00", icon: "SiNetflix" },
      { id: 31, name: "Disney+ Hotstar", price: "4.00", icon: "SiHotstar" },
      { id: 32, name: "SonyLIV", price: "3.00", icon: "SiSony" },
      { id: 33, name: "Zee5", price: "4.00", icon: "SiZend" },
      { id: 34, name: "JioCinema", price: "2.00", icon: "SiJirasoftware" },
      { id: 35, name: "Voot", price: "2.00", icon: "SiVlcmediaplayer" },
      { id: 36, name: "MX Player", price: "3.00", icon: "SiMxlinux" },
      { id: 37, name: "Amazon Prime", price: "5.00", icon: "SiAmazonprime" },
      { id: 38, name: "Apple TV+", price: "3.00", icon: "SiAppletv" },
      { id: 39, name: "Spotify", price: "4.00", icon: "SiSpotify" },
      { id: 40, name: "Gaana", price: "3.00", icon: "SiGoogleanalytics" },
      { id: 41, name: "JioSaavn", price: "2.00", icon: "SiJirasoftware" },
      { id: 42, name: "Wynk Music", price: "3.00", icon: "SiWeasyl" },
      { id: 43, name: "Dream11", price: "5.00", icon: "SiDreamhost" },
      { id: 44, name: "MPL", price: "4.00", icon: "SiMatterport" },
      { id: 45, name: "WinZO", price: "3.00", icon: "SiWii" },
      { id: 46, name: "My11Circle", price: "4.00", icon: "SiMysql" },
      { id: 47, name: "RummyCircle", price: "3.00", icon: "SiReadthedocs" },
      { id: 48, name: "PokerBaazi", price: "4.00", icon: "SiPokemon" },
      { id: 49, name: "Gamezy", price: "3.00", icon: "SiGamejolt" },
      { id: 50, name: "Paytm", price: "5.00", icon: "SiPatreon" },
      { id: 51, name: "PhonePe", price: "4.00", icon: "SiPhone" },
      { id: 52, name: "Google Pay", price: "5.00", icon: "SiGooglepay" },
      { id: 53, name: "Freecharge", price: "3.00", icon: "SiFreebsd" },
      { id: 54, name: "Mobikwik", price: "2.00", icon: "SiMobx" },
      { id: 55, name: "YONO SBI", price: "4.00", icon: "SiYoyo" },
      { id: 56, name: "ICICI iMobile", price: "5.00", icon: "SiIcloud" },
      { id: 57, name: "HDFC Bank", price: "4.00", icon: "SiHere" },
      { id: 58, name: "LinkedIn", price: "5.00", icon: "SiLinkedin" },
      { id: 59, name: "Naukri", price: "4.00", icon: "SiNintendo" },
      { id: 60, name: "Indeed", price: "3.00", icon: "SiInstapaper" },
      { id: 61, name: "Upwork", price: "4.00", icon: "SiUpwork" },
      { id: 62, name: "Fiverr", price: "3.00", icon: "SiFigma" },
      { id: 63, name: "Unacademy", price: "5.00", icon: "SiUbuntu" },
      { id: 64, name: "BYJU'S", price: "4.00", icon: "SiByte" },
      { id: 65, name: "Vedantu", price: "3.00", icon: "SiVenmo" },
      { id: 66, name: "Udemy", price: "5.00", icon: "SiUdemy" },
      { id: 67, name: "Coursera", price: "4.00", icon: "SiCoursera" },
      { id: 68, name: "WazirX", price: "5.00", icon: "SiWeasyl" },
      { id: 69, name: "CoinDCX", price: "4.00", icon: "SiCoinbase" },
      { id: 70, name: "Binance", price: "5.00", icon: "SiBinance" },
      { id: 71, name: "Groww", price: "5.00", icon: "SiGroww" },
      { id: 72, name: "Upstox", price: "4.00", icon: "SiUpwork" },
      { id: 73, name: "MakeMyTrip", price: "5.00", icon: "SiMattermost" },
      { id: 74, name: "IRCTC", price: "4.00", icon: "SiIterm2" },
      { id: 75, name: "Uber", price: "5.00", icon: "SiUber" },
      { id: 76, name: "Ola", price: "4.00", icon: "SiOlympics" },
      { id: 77, name: "Rapido", price: "3.00", icon: "SiRapid" },
      { id: 78, name: "Tinder", price: "5.00", icon: "SiTinder" },
      { id: 79, name: "Bumble", price: "4.00", icon: "SiBunpo" },
      { id: 80, name: "Google Drive", price: "5.00", icon: "SiGoogledrive" },
      { id: 81, name: "Dropbox", price: "4.00", icon: "SiDropbox" },
      { id: 82, name: "OneDrive", price: "3.00", icon: "SiMicrosoftonedrive" },
      { id: 83, name: "Notion", price: "3.00", icon: "SiNotion" },
      { id: 84, name: "Trello", price: "5.00", icon: "SiTrello" },
      { id: 85, name: "Asana", price: "4.00", icon: "SiAsana" },
      { id: 4, name: "My11Circle", price: "3.64", icon: "SiCircle" },
      { id: 5, name: "Gamezy", price: "3.07", icon: "SiGamejolt" },
      { id: 6, name: "PlayerzPot", price: "1.22", icon: "SiPlaystation" },
      { id: 7, name: "Teen Patti Gold", price: "2.24", icon: "SiTencentqq" },
      { id: 8, name: "Ludo King", price: "2.93", icon: "SiKinsta" },
      { id: 9, name: "RozDhan", price: "2.28", icon: "SiRoamresearch" },
      { id: 10, name: "Google Pay", price: "2.29", icon: "SiGooglepay" },
      { id: 11, name: "PhonePe", price: "1.91", icon: "SiPhone" },
      { id: 12, name: "Paytm", price: "2.57", icon: "SiPatreon" },
      { id: 13, name: "WhatsApp", price: "2.63", icon: "SiWhatsapp" },
      { id: 14, name: "Facebook", price: "3.88", icon: "SiFacebook" },
      { id: 15, name: "Instagram", price: "4.17", icon: "SiInstagram" },
      { id: 16, name: "YouTube", price: "4.89", icon: "SiYoutube" },
      { id: 17, name: "Amazon", price: "4.26", icon: "SiAmazon" },
      { id: 18, name: "Flipkart", price: "1.90", icon: "SiFlipkart" },
      { id: 19, name: "Netflix", price: "1.84", icon: "SiNetflix" },
      { id: 20, name: "Hotstar", price: "1.34", icon: "SiHotstar" },
      { id: 21, name: "Zomato", price: "2.16", icon: "SiZomato" },
      { id: 22, name: "Swiggy", price: "2.33", icon: "SiSwiggy" },
      { id: 23, name: "CRED", price: "1.31", icon: "SiCreativecommons" },
      { id: 24, name: "Zerodha", price: "4.62", icon: "SiZerodha" },
      { id: 25, name: "Groww", price: "1.69", icon: "SiGroww" },
      { id: 26, name: "Upstox", price: "3.88", icon: "SiUpwork" },
      { id: 27, name: "MagicPin", price: "2.51", icon: "SiPinterest" },
      { id: 28, name: "Slice", price: "2.01", icon: "SiSlice" },
      { id: 29, name: "5Paisa", price: "4.30", icon: "SiCashapp" },
      { id: 30, name: "CashKaro", price: "3.22", icon: "SiCash" },
      // Additional gaming and betting apps
      { id: 31, name: "RummyCircle", price: "4.20", icon: "SiCircle" },
      { id: 32, name: "PokerBaazi", price: "3.45", icon: "SiPokemon" },
      { id: 33, name: "A23 Rummy", price: "2.55", icon: "SiAframe" },
      { id: 34, name: "FanFight", price: "2.85", icon: "SiFandom" },
      { id: 35, name: "BalleBaazi", price: "3.99", icon: "SiBandsintown" },
      // Social and payment apps
      { id: 36, name: "Snapchat", price: "4.57", icon: "SiSnapchat" },
      { id: 37, name: "Telegram", price: "3.45", icon: "SiTelegram" },
      { id: 38, name: "Twitter", price: "4.92", icon: "SiTwitter" },
      { id: 39, name: "LinkedIn", price: "1.34", icon: "SiLinkedin" },
      { id: 40, name: "Uber", price: "3.00", icon: "SiUber" },
      // Additional secure services
      { id: 41, name: "SecureVerify", price: "4.15", icon: "SiVercel" },
      { id: 42, name: "MegaPay", price: "2.84", icon: "SiMega" },
      { id: 43, name: "UltraShield", price: "3.52", icon: "SiUbisoft" },
      { id: 44, name: "SafeOTP", price: "2.08", icon: "SiSafari" },
      { id: 45, name: "QuickVerify", price: "3.84", icon: "SiQuicktime" },
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