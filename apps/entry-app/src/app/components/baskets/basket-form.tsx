import React, { useState } from 'react';
import { createBasket } from '../../api/baskets/baskets.api';

interface IBasketFormProps {
  onSubmit: () => void;
}

const BasketForm = ({ onSubmit }: IBasketFormProps) => {
  const [name, setName] = useState('');
  // const [response, setResponse] = useState<{ name: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBasket(name);
      // setResponse(result.data);
      setName('');
      onSubmit();
    } catch (error) {
      console.error('Error creating basket:', error);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter basket name"
          required
        />
        <button type="submit">Create Basket</button>
      </form>
      {/* {response && <p>Created basket: {response.name}</p>} */}
    </div>
  );
};

export default BasketForm;
