import React, { useEffect, useState } from 'react';
import { getAllBaskets } from '../api/baskets/baskets.api';
import BasketForm from '../components/baskets/basket-form';
import Baskets from '../components/baskets/baskets';

// duplicate of IBasket from api file
interface IBasket {
  _id: string;
  name: string;
}

export const BasketsPage = () => {
  const [baskets, setBaskets] = useState<IBasket[]>();

  const fetchBaskets = async () => {
    const response = await getAllBaskets();
    setBaskets((response as any).baskets);
  };

  useEffect(() => {
    fetchBaskets();
  }, []);

  return (
    <div>
      <BasketForm onSubmit={() => fetchBaskets()} />
      <Baskets baskets={baskets} onDelete={fetchBaskets} />
    </div>
  );
};
