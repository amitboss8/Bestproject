import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import fetch from "node-fetch";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Admin credentials check
function isAdminCredentials(username: string, password: string) {
  return username === "noobru" && password === "achara";
}

async function validateWithGoogleSheets(username: string, password: string) {
  try {
    const response = await fetch("https://sheetdb.io/api/v1/9q67tdt9akctr");
    const data = await response.json();

    return data.some((row: any) => 
      row.username === username && row.password === password
    );
  } catch (error) {
    console.error("Failed to validate with Google Sheets:", error);
    return false;
  }
}

async function updateReferralData(data: {
  username: string;
  referralCode: string;
  referredBy?: string;
  referralDate?: string;
  referralBonus?: "YES" | "NO";
}) {
  try {
    await fetch("https://sheetdb.io/api/v1/sz1doh2zq3h05", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: [data] }),
    });
  } catch (error) {
    console.error("Failed to update referral data:", error);
  }
}

async function updateReferralBonus(username: string) {
  try {
    await fetch("https://sheetdb.io/api/v1/sz1doh2zq3h05/username/" + username, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: { referralBonus: "YES" }
      }),
    });
  } catch (error) {
    console.error("Failed to update referral bonus:", error);
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Check for admin credentials first
        if (isAdminCredentials(username, password)) {
          let adminUser = await storage.getUserByUsername(username);
          if (!adminUser) {
            // Create admin user if not exists
            adminUser = await storage.createUser({
              username,
              password: await hashPassword(password),
            });
          }
          return done(null, adminUser);
        }

        // Regular user validation
        const isValidGoogleSheets = await validateWithGoogleSheets(username, password);
        if (!isValidGoogleSheets) {
          return done(null, false);
        }

        let user = await storage.getUserByUsername(username);
        if (!user) {
          // Create user if not exists since Google Sheets validation passed
          user = await storage.createUser({
            username,
            password: await hashPassword(password),
          });

          // Update Google Sheets with referral code
          await updateReferralData({
            username: user.username,
            referralCode: user.referCode,
          });
        } else if (!(await comparePasswords(password, user.password))) {
          return done(null, false);
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const { username, password, referralCode } = req.body;

    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    try {
      // Validate referral code if provided
      let referrer;
      if (referralCode) {
        referrer = await storage.getUserByReferCode(referralCode);
        if (!referrer) {
          return res.status(400).json({ message: "Invalid referral code" });
        }
      }

      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        referredBy: referrer?.referCode
      });

      // Update Google Sheets with referral data
      await updateReferralData({
        username: user.username,
        referralCode: user.referCode,
        referredBy: referrer?.username || "",
        referralDate: new Date().toISOString(),
        referralBonus: "NO"
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}