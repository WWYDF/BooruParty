// Basic LAPIS JSON storage
// Was thinking about using SQLite with Prisma, but right now we're only changing basic numbers every few hours. (overkill)

import { promises as fs } from 'fs';
import path from 'path';

export interface LapisData {
  megaBytesUsed: number
}

const LAPIS_PATH = path.join(process.cwd(), 'data', 'lapis.json');

/**
 * Read data from lapis.json
 */
export async function readLapisDb<T = any>(): Promise<T> {
  try {
    const fileContent = await fs.readFile(LAPIS_PATH, 'utf-8');
    return JSON.parse(fileContent) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('lapis.json not found');
    }
    throw new Error(`Failed to read lapis.json: ${(error as Error).message}`);
  }
}

/**
 * Write data to lapis.json (overwrites)
 */
export async function writeLapisDb<T = any>(data: T): Promise<void> {
  try {
    // Ensure data directory exists
    await fs.mkdir(path.dirname(LAPIS_PATH), { recursive: true });
    
    const jsonString = JSON.stringify(data, null, 2);
    await fs.writeFile(LAPIS_PATH, jsonString, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write lapis.json: ${(error as Error).message}`);
  }
}

/**
 * Update lapis.json (merge with existing data)
 */
export async function updateLapisDb<T extends Record<string, any>>(
  updates: Partial<T>
): Promise<T> {
  try {
    let existingData: T;
    
    try {
      existingData = await readLapisDb<T>();
    } catch {
      existingData = {} as T;
    }
    
    const updatedData = { ...existingData, ...updates };
    await writeLapisDb(updatedData);
    
    return updatedData;
  } catch (error) {
    throw new Error(`Failed to update lapis.json: ${(error as Error).message}`);
  }
}

/**
 * Check if lapis.json exists
 */
export async function lapisDbExists(): Promise<boolean> {
  try {
    await fs.access(LAPIS_PATH);
    return true;
  } catch {
    return false;
  }
}