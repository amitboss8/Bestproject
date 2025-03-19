import { pgTable, text, serial, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  walletBalance: decimal("wallet_balance").notNull().default("0"),
  referCode: text("refer_code").notNull(),
  referredBy: text("referred_by"),
  referralRewardClaimed: text("referral_reward_claimed").default("no")
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  amount: decimal("amount").notNull(),
  utrNumber: text("utr_number").notNull(),
  status: text("status").notNull(), // "approved" | "rejected"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  type: text("type").default("deposit") // "deposit" | "referral_bonus"
});

export const otpServices = pgTable("otp_services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: decimal("price").notNull(),
  icon: text("icon").notNull()
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  referredBy: true
}).partial({
  referredBy: true
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  amount: true,
  utrNumber: true
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type OTPService = typeof otpServices.$inferSelect;