import { utilFetch } from '@lifeis/common-ui';
import React from 'react';

interface IBasket {
  _id: string;
  name: string;
}

interface BasketsProps {
  baskets: IBasket[] | undefined;
  onDelete?: () => void;
}

const Baskets: React.FC<BasketsProps> = ({ baskets, onDelete }) => {
  const handleRemove = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete basket "${name}"?`)) return;
    try {
      await utilFetch(`/baskets/${id}`, { method: 'DELETE' });
      onDelete && onDelete();
    } catch (e) {
      // Optionally handle error
    }
  };

  return (
    <div>
      <h2>Baskets</h2>
      <ul>
        {baskets &&
          baskets.map((basket) => (
            <li key={basket._id} className="basket-item" style={{ display: 'flex', alignItems: 'center' }}>
              <span className="basket-name">{basket.name}</span>
              <button
                style={{
                  marginLeft: 8,
                  color: 'red',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
                onClick={() => handleRemove(basket._id, basket.name)}
                aria-label={`Remove basket ${basket.name}`}
              >
                ×
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
};

export default Baskets;
