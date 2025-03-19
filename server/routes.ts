import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertTransactionSchema } from "@shared/schema";
import { ZodError } from "zod";

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
      
      // Create transaction record
      const transaction = await storage.createTransaction(
        req.user.id,
        parseFloat(amount),
        utrNumber
      );

      // Update user's wallet balance
      const user = await storage.updateWalletBalance(
        req.user.id,
        parseFloat(amount)
      );

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

  const httpServer = createServer(app);
  return httpServer;
}
