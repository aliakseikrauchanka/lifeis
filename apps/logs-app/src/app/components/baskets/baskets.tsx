import { utilFetch } from '@lifeis/common-ui';
import React from 'react';
import { Box } from '@mui/material';
import css from './baskets.module.scss';

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
      onDelete?.();
    } catch (_e) {
      // Optionally handle error
    }
  };

  return (
    <Box mt={2}>
      <table className={css.basketsTable}>
        <thead>
          <tr>
            <th className={css.basketNameCol}>Basket Name</th>
            <th className={css.actionsCol}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {baskets?.map((basket) => (
            <tr key={basket._id}>
              <td className={css.basketNameCell}>{basket.name}</td>
              <td className={css.actionsCell}>
                <button
                  className={css.deleteButton}
                  onClick={() => handleRemove(basket._id, basket.name)}
                  aria-label={`Delete basket ${basket.name}`}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
};

export default Baskets;
