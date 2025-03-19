import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertTransactionSchema } from "@shared/schema";
import { ZodError } from "zod";
import fetch from "node-fetch";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Get user balance
  app.get("/api/balance", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json({ balance: req.user.walletBalance });
  });

  // Add balance
  app.post("/api/balance", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { amount, utrNumber } = insertTransactionSchema.parse(req.body);
      const parsedAmount = parseFloat(amount);

      // Create transaction record
      const transaction = await storage.createTransaction(
        req.user.id,
        parsedAmount,
        utrNumber
      );

      // Update user's wallet balance
      const user = await storage.updateWalletBalance(
        req.user.id,
        parsedAmount
      );

      // If this is user's first 100+ deposit and they were referred
      if (parsedAmount >= 100) {
        await storage.processReferralReward(req.user.id);

        // Update referral bonus status in Google Sheets
        try {
          await fetch("https://sheetdb.io/api/v1/sz1doh2zq3h05/username/" + user.username, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              data: { referralBonus: "YES" }
            }),
          });

          if (user.referredBy) {
            const referrer = await storage.getUserByReferCode(user.referredBy);
            if (referrer) {
              await fetch("https://sheetdb.io/api/v1/sz1doh2zq3h05/username/" + referrer.username, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  data: { referralBonus: "YES" }
                }),
              });
            }
          }
        } catch (error) {
          console.error("Failed to update referral bonus in Google Sheets:", error);
        }
      }

      res.json({ transaction, user });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ message: "Invalid input data" });
      } else {
        res.status(500).json({ message: "Failed to process transaction" });
      }
    }
  });

  // Get transaction history
  app.get("/api/transactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const transactions = await storage.getTransactions(req.user.id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Get OTP services
  app.get("/api/otp-services", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const services = await storage.getOTPServices();
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch OTP services" });
    }
  });

  // Get referral stats
  app.get("/api/referral-stats", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const stats = await storage.getReferralStats(req.user.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Validate referral code
  app.get("/api/validate-referral/:code", async (req, res) => {
    try {
      const user = await storage.getUserByReferCode(req.params.code);
      if (user) {
        res.json({ valid: true });
      } else {
        res.json({ valid: false });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to validate referral code" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}