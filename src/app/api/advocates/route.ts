import db from "../../../db";
import { advocates } from "../../../db/schema";
import { Advocate } from "@/app/types/db";
import { NextRequest } from "next/server";
import { eq, or, sql, ilike, count } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

// Input validation and sanitization utilities
const sanitizeSearchQuery = (query: string): string => {
  // Remove null bytes and control characters
  let sanitized = query.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Limit length to prevent buffer overflow attacks
  sanitized = sanitized.substring(0, 100);
  
  // Normalize whitespace - replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
};

const validateSearchQuery = (query: string): { isValid: boolean; sanitized?: string; error?: string } => {
  // Check for empty or whitespace-only queries
  if (!query || query.trim() === '') {
    return { isValid: false, error: 'Search query cannot be empty' };
  }
  
  // Check length limits
  if (query.length > 100) {
    return { isValid: false, error: 'Search query too long (max 100 characters)' };
  }
  
  // Check for potentially malicious patterns
  const maliciousPatterns = [
    /union\s+select/i,
    /drop\s+table/i,
    /delete\s+from/i,
    /insert\s+into/i,
    /update\s+set/i,
    /alter\s+table/i,
    /exec\s*\(/i,
    /script\s*>/i,
    /<script/i,
    /javascript:/i,
    /onload\s*=/i,
    /onerror\s*=/i
  ];
  
  for (const pattern of maliciousPatterns) {
    if (pattern.test(query)) {
      return { isValid: false, error: 'Search query contains potentially malicious content' };
    }
  }
  
  // Sanitize the query
  const sanitized = sanitizeSearchQuery(query);
  
  // Check if sanitization removed too much content
  if (sanitized.length < 1) {
    return { isValid: false, error: 'Search query contains only invalid characters' };
  }
  
  return { isValid: true, sanitized };
};

// Cached function to get all advocates with pagination
const getAllAdvocates = unstable_cache(
  async (page: number, limit: number) => {
    const offset = (page - 1) * limit;
    return await db.select().from(advocates).limit(limit).offset(offset);
  },
  ['all-advocates'],
  {
    revalidate: 60, // Cache for 1 minute
    tags: ['advocates']
  }
);

// Cached function to get total count of advocates
const getAdvocatesCount = unstable_cache(
  async () => {
    const result = await db.select({ count: count() }).from(advocates);
    return result[0].count;
  },
  ['advocates-count'],
  {
    revalidate: 60, // Cache for 1 minute
    tags: ['advocates']
  }
);

// Cached function to search advocates with pagination
const searchAdvocates = unstable_cache(
  async (searchQuery: string, page: number, limit: number) => {
    const offset = (page - 1) * limit;
    return await db.select().from(advocates).where(or(
      ilike(advocates.firstName, `%${searchQuery}%`),
      ilike(advocates.lastName, `%${searchQuery}%`),
      ilike(advocates.city, `%${searchQuery}%`),
      ilike(advocates.degree, `%${searchQuery}%`),
      sql`${advocates.phoneNumber}::text ILIKE ${'%' + searchQuery + '%'}`,
      sql`${advocates.specialties}::text ILIKE ${'%' + searchQuery + '%'}`,
      (!isNaN(Number(searchQuery))) ? eq(advocates.yearsOfExperience, Number(searchQuery)) : sql`false`
    )).limit(limit).offset(offset);
  },
  ['search-advocates'],
  {
    revalidate: 60, // Cache search results for 1 minute
    tags: ['advocates', 'search']
  }
);

// Cached function to get search results count
const getSearchAdvocatesCount = unstable_cache(
  async (searchQuery: string) => {
    const result = await db.select({ count: count() }).from(advocates).where(or(
      ilike(advocates.firstName, `%${searchQuery}%`),
      ilike(advocates.lastName, `%${searchQuery}%`),
      ilike(advocates.city, `%${searchQuery}%`),
      ilike(advocates.degree, `%${searchQuery}%`),
      sql`${advocates.phoneNumber}::text ILIKE ${'%' + searchQuery + '%'}`,
      sql`${advocates.specialties}::text ILIKE ${'%' + searchQuery + '%'}`,
      (!isNaN(Number(searchQuery))) ? eq(advocates.yearsOfExperience, Number(searchQuery)) : sql`false`
    ));
    return result[0].count;
  },
  ['search-advocates-count'],
  {
    revalidate: 60, // Cache search count for 1 minute
    tags: ['advocates', 'search']
  }
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const searchQuery = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  
  // Validate pagination parameters
  const validPage = Math.min(Math.max(1, page), 120000); // The USA is served by 1.1 million physicians (313 physicians per 100k people), so 120000 pages is a safe limit (displaying every physician in the USA on our minimum page size)
  const validLimit = Math.min(Math.max(10, limit), 100); // Max 100 items per page, minimum 10 items per page
  
  // If no search query or empty/whitespace, return all data with pagination
  if (!searchQuery || searchQuery.trim() === "") {
    const [allData, totalCount] = await Promise.all([
      getAllAdvocates(validPage, validLimit),
      getAdvocatesCount()
    ]);
    
    const totalPages = Math.ceil(totalCount / validLimit);
    
    return Response.json({ 
      data: allData,
      pagination: {
        page: validPage,
        limit: validLimit,
        total: totalCount,
        totalPages,
        hasNext: validPage < totalPages,
        hasPrev: validPage > 1
      }
    }, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        'ETag': `"all-advocates-${validPage}-${validLimit}-${Date.now()}"`
      }
    });
  }
  
  // Validate and sanitize the search query
  const validation = validateSearchQuery(searchQuery);
  
  if (!validation.isValid) {
    return Response.json({ 
      error: validation.error,
      message: 'Invalid search query provided'
    }, { 
      status: 400,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
  
  // Use the sanitized query for database operations
  const sanitizedQuery = validation.sanitized!;
  
  const [filteredData, totalCount] = await Promise.all([
    searchAdvocates(sanitizedQuery, validPage, validLimit),
    getSearchAdvocatesCount(sanitizedQuery)
  ]);
  
  const totalPages = Math.ceil(totalCount / validLimit);
  
  return Response.json({ 
    data: filteredData,
    pagination: {
      page: validPage,
      limit: validLimit,
      total: totalCount,
      totalPages,
      hasNext: validPage < totalPages,
      hasPrev: validPage > 1
    }
  }, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      'ETag': `"search-${sanitizedQuery}-${validPage}-${validLimit}-${Date.now()}"`
    }
  });
}
