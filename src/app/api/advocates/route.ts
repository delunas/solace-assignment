import db from "../../../db";
import { advocates } from "../../../db/schema";
import { Advocate } from "@/app/types/db";
import { NextRequest } from "next/server";
import { eq, or, sql, ilike, count } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

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
  const validPage = Math.max(1, page);
  const validLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page
  
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
  
  const [filteredData, totalCount] = await Promise.all([
    searchAdvocates(searchQuery.trim(), validPage, validLimit),
    getSearchAdvocatesCount(searchQuery.trim())
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
      'ETag': `"search-${searchQuery}-${validPage}-${validLimit}-${Date.now()}"`
    }
  });
}
