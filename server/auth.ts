import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GitHubStrategy, Profile as GitHubProfile } from "passport-github2";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, RoleTypes } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

// Password hash function
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Password verification function
async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Set up session
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "pixelmatch_secret_key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore, // Use the storage's session store (PostgreSQL or memory)
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    }
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport to use local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );
  
  // Configure passport to use GitHub strategy
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL: `/api/auth/github/callback`,
          scope: ["user:email"],
        },
        async (accessToken: string, refreshToken: string, profile: GitHubProfile, done: (error: Error | null, user?: any) => void) => {
          try {
            // Check if user with this GitHub ID already exists
            const existingUser = await storage.getUserByGithubId(profile.id);
            
            if (existingUser) {
              return done(null, existingUser);
            }
            
            // If not, check if user with the same email exists
            const email = profile.emails && profile.emails[0]?.value;
            
            if (email) {
              const userWithEmail = await storage.getUserByEmail(email);
              if (userWithEmail) {
                // Update existing user with GitHub info
                const updatedUser = await storage.updateUser(userWithEmail.id, {
                  githubId: profile.id,
                  profilePicture: profile.photos?.[0]?.value || userWithEmail.profilePicture
                });
                return done(null, updatedUser);
              }
            }
            
            // Create a new user
            const randomPassword = randomBytes(20).toString('hex');
            const user = await storage.createUser({
              username: profile.username || `github_${profile.id}`,
              email: email || `${profile.id}@github.nodomain`,
              password: await hashPassword(randomPassword),
              githubId: profile.id,
              name: profile.displayName || profile.username || '',
              role: 'user' as (typeof RoleTypes)[number],
              profilePicture: profile.photos?.[0]?.value || '',
              bio: (profile as any)._json?.bio || '',
              title: '',
              createdAt: new Date(),
            });
            
            return done(null, user);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  } else {
    console.warn('GitHub authentication is not configured. Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET');
  }

  // Serialize and deserialize user
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Register endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(req.body.password);

      // Create user with hashed password
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      // Log in the newly registered user
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      res.status(500).json({ message: "Error registering user" });
    }
  });

  // Login endpoint
  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    // Return user without password
    const { password, ...userWithoutPassword } = req.user as SelectUser;
    res.status(200).json(userWithoutPassword);
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // User endpoint (to get current user)
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Return user without password
    const { password, ...userWithoutPassword } = req.user as SelectUser;
    res.json(userWithoutPassword);
  });
  
  // GitHub authentication routes
  app.get('/api/auth/github', passport.authenticate('github'));
  
  app.get(
    '/api/auth/github/callback',
    passport.authenticate('github', {
      successRedirect: '/',
      failureRedirect: '/auth'
    })
  );
}