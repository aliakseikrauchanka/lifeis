import React, { useState, useEffect } from "react";

import './App.css';

import { API, Storage } from "aws-amplify";
import { withAuthenticator, AmplifySignOut } from "@aws-amplify/ui-react"

import { listTodos } from "./graphql/queries";
import { createTodo as createTodoMutation, deleteTodo as deleteTodoMutation } from "./graphql/mutations";

interface IFormState {
  name: string;
  description: string;
  image?: string;
}
const initialFormState: IFormState = { name: '', description: '' };

const App: React.FC = () => {
  const [todos, setTodos] = useState<any[]>([]);
  const [formData, setFormData] = useState<IFormState>(initialFormState);

  useEffect(() => {
    fetchTodos();
  }, []);

  async function fetchTodos() {
    const apiData: any = await API.graphql({ query: listTodos })

    const fetchedTodos: any[] = apiData.data.listTodos.items;
    await Promise.all(fetchedTodos.map(async todo => {
      if (todo.image) {
        let image = await Storage.get(todo.image);
        todo.image = image;
      }
    }));

    setTodos(fetchedTodos);
  }

  async function addTodo() {
    if (!formData.name || !formData.description) { return }
    await API.graphql({ query: createTodoMutation, variables: { input: formData } });

    setTodos([...todos, formData]);
  }

  async function deleteTodo(todoId: string) {
    const newTodoArr = todos.filter(todo => todo.id !== todoId);
    setTodos(newTodoArr);
    await API.graphql({ query: deleteTodoMutation, variables: { input: { id: todoId } } })
  }

  return (
    <div className="App">
      <input
        placeholder="Type name"
        value={formData.name}
        onChange={e => {
          setFormData({ ...formData, name: e.target.value })
        }}
      />
      <input
        placeholder="Type description"
        value={formData.description}
        onChange={e => { setFormData({ ...formData, description: e.target.value }) }}
      />

      <button
        onClick={e => { addTodo(); }}
      >Add TODO</button>
      <div style={{ marginBottom: 30 }}>
        {
          todos.map(todo => (
            <div key={todo.id || todo.name}>
              <h2>{todo.name}</h2>
              <p>{todo.description}</p>
              {
                todo.image && <img src={todo.image} style={{ width: 400 }} alt="alt" />
              }

              <button onClick={() => deleteTodo(todo.id)}>Delete note</button>
            </div>
          ))
        }
      </div>
  
      <AmplifySignOut />
    </div>
  );
}

export default withAuthenticator(App);
