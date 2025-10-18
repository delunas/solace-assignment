import db from "../../../db";
import { advocates } from "../../../db/schema";
import { Advocate } from "@/app/types/db";
import { NextRequest } from "next/server";
import { eq, or, sql, ilike } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

// Cached function to get all advocates
const getAllAdvocates = unstable_cache(
  async () => {
    return await db.select().from(advocates);
  },
  ['all-advocates'],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ['advocates']
  }
);

// Cached function to search advocates
const searchAdvocates = unstable_cache(
  async (searchQuery: string) => {
    return await db.select().from(advocates).where(or(
      ilike(advocates.firstName, `%${searchQuery}%`),
      ilike(advocates.lastName, `%${searchQuery}%`),
      ilike(advocates.city, `%${searchQuery}%`),
      ilike(advocates.degree, `%${searchQuery}%`),
      sql`${advocates.phoneNumber}::text ILIKE ${'%' + searchQuery + '%'}`,
      sql`${advocates.specialties}::text ILIKE ${'%' + searchQuery + '%'}`,
      (!isNaN(Number(searchQuery))) ? eq(advocates.yearsOfExperience, Number(searchQuery)) : sql`false`
    ));
  },
  ['search-advocates'],
  {
    revalidate: 60, // Cache search results for 1 minute
    tags: ['advocates', 'search']
  }
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const searchQuery = searchParams.get("search");
  
  // If no search query or empty/whitespace, return all data
  if (!searchQuery || searchQuery.trim() === "") {
    const allData: Advocate[] = await getAllAdvocates();
    return Response.json({ data: allData }, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        'ETag': `"all-advocates-${Date.now()}"`
      }
    });
  }
  
  const filteredData: Advocate[] = await searchAdvocates(searchQuery.trim());
  
  return Response.json({ data: filteredData }, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      'ETag': `"search-${searchQuery}-${Date.now()}"`
    }
  });
}
