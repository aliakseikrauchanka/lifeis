import { useEffect, useState } from 'react';
import { getAllBaskets } from '../api/baskets/baskets.api';

export const useBaskets = () => {
  const [baskets, setBaskets] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchBaskets = async () => {
      try {
        const res = await getAllBaskets();
        setBaskets((res as { baskets?: { _id: string; name: string }[] }).baskets || []);
      } catch {
        // ignore
      }
    };
    fetchBaskets();
  }, []);

  return { baskets };
};
