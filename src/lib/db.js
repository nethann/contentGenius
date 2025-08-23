import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { eq, desc } from 'drizzle-orm';
import * as schema from './schema.js';

// Create the PostgreSQL client
const client = new Client({
  connectionString: import.meta.env.VITE_NEON_DATABASE_URL,
});

// Connect to the database
let connected = false;
const connectDB = async () => {
  if (!connected) {
    try {
      await client.connect();
      connected = true;
      console.log('✅ Connected to Neon PostgreSQL');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }
};

// Create the Drizzle database instance
export const db = drizzle(client, { schema });

// Helper function to ensure user exists in database
export const ensureUser = async (clerkUser) => {
  try {
    await connectDB();
    
    const existingUser = await db.select().from(schema.users).where(eq(schema.users.id, clerkUser.id)).limit(1);
    
    if (existingUser.length > 0) {
      return existingUser[0];
    }

    // Determine user tier based on email
    const adminEmails = ['nethan.nagendran@gmail.com', 'nethmarket@gmail.com'];
    const userTier = adminEmails.includes(clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase()) 
      ? 'developer' 
      : 'guest';

    // Create new user
    const newUser = await db.insert(schema.users).values({
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      imageUrl: clerkUser.imageUrl || '',
      userTier,
      subscriptionStatus: userTier === 'guest' ? 'inactive' : 'active',
      isActive: true,
    }).returning();

    return newUser[0];
  } catch (error) {
    console.error('Error ensuring user:', error);
    throw error;
  }
};

// Helper function to update user tier
export const updateUserTier = async (userId, newTier) => {
  try {
    await connectDB();
    
    const updatedUser = await db
      .update(schema.users)
      .set({ 
        userTier: newTier,
        subscriptionStatus: newTier === 'guest' ? 'inactive' : 'active',
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, userId))
      .returning();

    return updatedUser[0];
  } catch (error) {
    console.error('Error updating user tier:', error);
    throw error;
  }
};

// Helper function to get all users (admin only)
export const getAllUsers = async () => {
  try {
    await connectDB();
    
    const users = await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
    return users;
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
};

// Helper function to log user activity
export const logUserActivity = async (userId, action, details = null) => {
  try {
    await connectDB();
    
    await db.insert(schema.userActivity).values({
      userId,
      action,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (error) {
    console.error('Error logging user activity:', error);
    // Don't throw - activity logging is not critical
  }
};