import React from 'react';

interface IBasket {
  _id: string;
  name: string;
}

interface BasketsProps {
  baskets: IBasket[] | undefined;
}

const Baskets: React.FC<BasketsProps> = ({ baskets }) => {
  return (
    <div>
      <h2>Baskets</h2>
      <ul>
        {baskets &&
          baskets.map((basket) => (
            <li key={basket._id} className="basket-item">
              <span className="basket-name">{basket.name}</span>
            </li>
          ))}
      </ul>
    </div>
  );
};

export default Baskets;
