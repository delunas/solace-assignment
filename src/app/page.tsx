"use client";

import { useEffect, useState, useCallback } from "react";
import { Advocate } from "./types/db";

export default function Home() {
  const [advocates, setAdvocates] = useState<Advocate[]>([]);
  const [filteredAdvocates, setFilteredAdvocates] = useState<Advocate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const tableHeaders = ["Name", "City", "Specialties", "Years of Experience", "Phone Number"];

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/advocates").then((response) => {
      response.json().then((jsonResponse) => {
        setAdvocates(jsonResponse.data);
        setFilteredAdvocates(jsonResponse.data);
        setIsLoading(false);
      });
    });
  }, []);

  const searchAdvocates = useCallback(async (query: string) => {
    try {
      setIsLoading(true);
      const url = query.trim() === "" 
        ? "/api/advocates" 
        : `/api/advocates?search=${encodeURIComponent(query)}`;
      
      const response = await fetch(url);
      const jsonResponse = await response.json();
      setFilteredAdvocates(jsonResponse.data);
      setIsLoading(false);
    } catch (error) {
      console.error("Error searching advocates:", error);
      setIsLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (query: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          searchAdvocates(query);
        }, 150);
      };
    })(),
    [searchAdvocates]
  ); 
  
  // usecallback hook here to avoid re-rendering the component unnecessarily. 
  // function is wrapped in an anonymous function to keep timeoutId in a closure, preventing it from being garbage collected and reset
  // this also uses immediate invocation to avoid the need to bind the function to the component

  const resetList = () => {
    setSearchTerm("");
    setFilteredAdvocates(advocates);
  };

  const onSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    debouncedSearch(value);
  };

  const formatPhoneNumber = (phoneNumber: string | null | undefined): string => {
    if (!phoneNumber) return "";
    const phoneStr = String(phoneNumber);
    return `(${phoneStr.slice(0,3)}) ${phoneStr.slice(3,6)}-${phoneStr.slice(6,10)}`;
  };

  return (
    <main className="xl:m-[24px] m-[12px]">
      <h1 className="xl:mb-12 sm:mb-6 mb-4">Solace Advocates</h1>
      <div className="xl:mb-12 sm:mb-6 mb-4">
        <input 
          className="border border-black xl:text-base sm:text-sm" 
          value={searchTerm}
          onChange={onSearchInputChange} 
          placeholder="Search" 
        />
        <button 
          onClick={() => resetList()} 
          className="xl:text-base sm:text-sm ml-4 px-4 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Reset Search
        </button>
      </div>

      <table className="w-full text-left table-fixed xl:text-base sm:text-sm text-xs">
        <thead>
          <tr className="bg-gray-100 text-center">
            {tableHeaders.map((header : string) => (
              <th key={header} className= "p-1 w-1/5">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="before:content-[''] before:block before:h-4">
          {filteredAdvocates.map((advocate : Advocate, index : number) => {
              return (
                <tr key={`row-${index}`} className="border-b border-gray-200">
                  <td className="p-1 mx-1">{`${advocate.firstName} ${advocate.lastName} ${advocate.degree}`}</td>
                  <td className="p-1 mx-1">{advocate.city}</td>
                  <td className="p-1 mx-1">
                    <div className="flex flex-wrap gap-1">
                      {(advocate.specialties as string[]).map((s: string, specIndex: number) => (
                        <span key={specIndex} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-1 mx-1 text-center">{advocate.yearsOfExperience}</td>
                  <td className="p-1 mx-1 text-center">
                    {formatPhoneNumber(String(advocate.phoneNumber))}
                  </td>
                </tr>
              );
          })}
        </tbody>
      </table>
      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading...</span>
        </div>
      )}
      {!isLoading && filteredAdvocates.length === 0 && (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="text-gray-500 text-lg mb-2">No Advocates Found</div>
            <div className="text-gray-400 text-sm">
              {searchTerm ? `No advocates match your search for "${searchTerm}"` : "No advocates available"}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}