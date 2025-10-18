interface PaginationProps {
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export default function Pagination({
  page,
  totalPages,
  hasNext,
  hasPrev,
  onPrevious,
  onNext,
}: PaginationProps) {
  return (
    <div className="flex py-4 gap-x-4 items-baseline justify-end w-full">
      <button 
        onClick={onPrevious} 
        disabled={!hasPrev}
        className={`xl:text-base sm:text-sm px-4 py-0.5 rounded transition-colors order-1 ${
          !hasPrev 
            ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
            : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
        }`}
      >
        Previous
      </button>
      <div className="xl:text-base sm:text-sm text-gray-600 order-2">
        <span>{page} of {totalPages}</span>
      </div>
      <button 
        onClick={onNext} 
        disabled={!hasNext}
        className={`xl:text-base sm:text-sm px-4 py-0.5 rounded transition-colors order-3 ${
          !hasNext
            ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
            : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
        }`}
      >
        Next
      </button>
    </div>
  );
}
